// api/_lib/pit/operationalIntelligence.js
// Operational Intelligence
// Looks beyond price. Assesses what the merchant's payments operation reveals,
// what is missing, and what operational questions should be validated next.

const text = v => String(v ?? '').toLowerCase();

function includesAny(source, terms) {
  const s = text(source);
  return terms.some(t => s.includes(t));
}

function isOnlineMerchant(merchantProfile = {}, facts = {}) {
  const haystack = [
    merchantProfile.businessModel,
    merchantProfile.channelProfile,
    merchantProfile.industry,
    facts.context?.raw,
    facts.observations?.join(' '),
    facts.setup?.map(x => `${x.label} ${x.value}`).join(' ')
  ].join(' ');
  return /online|ecommerce|e-commerce|card-not-present|cnp|gateway|shopify|website/.test(text(haystack));
}

function isCardPresentMerchant(merchantProfile = {}, facts = {}) {
  const haystack = [
    merchantProfile.businessModel,
    merchantProfile.channelProfile,
    facts.context?.raw,
    facts.observations?.join(' '),
    facts.setup?.map(x => `${x.label} ${x.value}`).join(' ')
  ].join(' ');
  return /terminal|eftpos|pos|card-present|card present|in-store|instore|store/.test(text(haystack));
}

export function buildOperationalIntelligence({ facts = {}, merchantProfile = {}, paymentsStack = {}, metrics = {} }) {
  const online = isOnlineMerchant(merchantProfile, facts);
  const cardPresent = isCardPresentMerchant(merchantProfile, facts);

  const intelligence = {
    profile: {
      online,
      cardPresent,
      omnichannel: online && cardPresent,
      operationalMaturity: 'Needs validation'
    },
    routing: assessRouting({ facts, metrics, paymentsStack, online, cardPresent }),
    chargebacks: assessChargebacks({ facts, online }),
    refunds: assessRefunds({ facts, metrics }),
    settlement: assessSettlement({ facts }),
    gateway: assessGateway({ facts, merchantProfile, paymentsStack, online }),
    reporting: assessReporting({ facts, metrics, paymentsStack }),
    frictionPoints: [],
    validationQuestions: []
  };

  intelligence.frictionPoints = [
    ...intelligence.routing.frictionPoints,
    ...intelligence.chargebacks.frictionPoints,
    ...intelligence.gateway.frictionPoints,
    ...intelligence.reporting.frictionPoints
  ];

  intelligence.validationQuestions = [
    ...intelligence.routing.validationQuestions,
    ...intelligence.chargebacks.validationQuestions,
    ...intelligence.gateway.validationQuestions,
    ...intelligence.reporting.validationQuestions
  ];

  const highVisibility =
    metrics?.dataCompleteness?.level === 'High' &&
    paymentsStack?.completeness === 'High' &&
    intelligence.validationQuestions.length <= 2;

  intelligence.profile.operationalMaturity = highVisibility
    ? 'Reasonably visible from current data'
    : 'Partial visibility only';

  return intelligence;
}

function assessRouting({ facts, metrics, paymentsStack, online, cardPresent }) {
  const lcrStatus = facts.lcrStatus || paymentsStack.lcrStatus || 'Unknown';
  const debitPct = metrics.cardMix?.debitPct ?? facts.cardMix?.debit ?? null;

  const out = {
    area: 'Routing',
    lcrStatus,
    debitMix: debitPct,
    relevance: debitPct > 10 ? 'Relevant' : 'Low',
    confidence: lcrStatus && lcrStatus !== 'Unknown' ? 'Confirmed' : 'Needs validation',
    frictionPoints: [],
    validationQuestions: []
  };

  if (debitPct > 10 && (!lcrStatus || lcrStatus === 'Unknown')) {
    out.frictionPoints.push('Debit routing is commercially relevant but current LCR configuration is not confirmed.');
    out.validationQuestions.push('Confirm whether least-cost routing is active for card-present, online and wallet transactions.');
  }

  if (online) {
    out.validationQuestions.push('Confirm whether online debit transactions are eligible for least-cost routing through the gateway/acquirer setup.');
  }

  if (cardPresent) {
    out.validationQuestions.push('Confirm whether terminal transactions are configured for merchant choice routing.');
  }

  return out;
}

function assessChargebacks({ facts, online }) {
  const visible = !!facts.chargebacks;
  const out = {
    area: 'Chargebacks',
    visible,
    confidence: visible ? 'Confirmed' : 'Needs validation',
    riskRelevance: online ? 'Medium' : 'Low',
    frictionPoints: [],
    validationQuestions: []
  };

  if (visible) {
    out.count = facts.chargebacks.count ?? null;
    out.amount = facts.chargebacks.amount ?? null;
    out.fees = facts.chargebacks.fees ?? null;
    out.ratio = facts.chargebacks.ratio ?? null;
  } else {
    out.frictionPoints.push('Chargeback data is not visible in the current statement.');
    if (online) {
      out.validationQuestions.push('Request gateway/acquirer dispute reporting to assess chargeback exposure for online transactions.');
    }
  }

  return out;
}

function assessRefunds({ facts, metrics }) {
  const obs = (facts.observations || []).join(' ');
  const refundMentioned = /refund/.test(text(obs));
  return {
    area: 'Refunds',
    visible: refundMentioned,
    confidence: refundMentioned ? 'Likely' : 'Unknown',
    note: refundMentioned
      ? 'Refund activity appears in the observations and may be relevant to operational review.'
      : 'Refund activity is not clearly available as a structured metric.'
  };
}

function assessSettlement({ facts }) {
  const haystack = [
    facts.observations?.join(' '),
    facts.setup?.map(x => `${x.label} ${x.value}`).join(' ')
  ].join(' ');

  const visible = /settlement|payout|deposit|remittance/.test(text(haystack));
  return {
    area: 'Settlement',
    visible,
    confidence: visible ? 'Likely' : 'Needs validation',
    validationQuestions: visible ? [] : ['Confirm settlement timing, funding account structure and reconciliation process.']
  };
}

function assessGateway({ facts, merchantProfile, paymentsStack, online }) {
  const gatewayVisible = !!paymentsStack.gateway;
  const out = {
    area: 'Gateway',
    visible: gatewayVisible,
    confidence: gatewayVisible ? 'Likely' : online ? 'Needs validation' : 'Low relevance',
    frictionPoints: [],
    validationQuestions: []
  };

  if (online && !gatewayVisible) {
    out.frictionPoints.push('Online acceptance appears relevant, but gateway costs and configuration are not visible.');
    out.validationQuestions.push('Request gateway invoice or gateway transaction export to assess full cost of acceptance.');
  }

  if (online) {
    out.validationQuestions.push('Confirm tokenisation, 3DS, fraud tooling and gateway routing capabilities.');
  }

  return out;
}

function assessReporting({ facts, metrics, paymentsStack }) {
  const out = {
    area: 'Reporting',
    dataCompleteness: metrics.dataCompleteness?.level || 'Unknown',
    stackCompleteness: paymentsStack.completeness || 'Unknown',
    confidence: 'Estimated',
    frictionPoints: [],
    validationQuestions: []
  };

  if (out.dataCompleteness !== 'High') {
    out.frictionPoints.push('Current data does not provide a complete view of all payment cost and operational drivers.');
    out.validationQuestions.push('Collect gateway invoices, dispute reports, contracts and transaction-level exports to improve PIT confidence.');
  }

  return out;
}

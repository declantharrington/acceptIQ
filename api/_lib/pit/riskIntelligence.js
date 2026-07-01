// api/_lib/pit/riskIntelligence.js
// Risk Intelligence
// Separates savings opportunities from commercial, operational, regulatory and
// data-quality risks.

export function buildRiskIntelligence({
  facts = {},
  merchantProfile = {},
  paymentsStack = {},
  metrics = {},
  operationalIntelligence = {},
  industryIntelligence = {}
}) {
  const risks = [];

  addSurchargeRisk(risks, facts, paymentsStack, industryIntelligence);
  addIncompleteCostRisk(risks, paymentsStack, operationalIntelligence);
  addRoutingRisk(risks, facts, metrics);
  addChargebackVisibilityRisk(risks, merchantProfile, operationalIntelligence);
  addDataRisk(risks, metrics);
  addContractRisk(risks, facts, paymentsStack);

  const severityOrder = { High: 3, Medium: 2, Low: 1 };
  risks.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

  return {
    risks,
    riskProfile: summariseRiskProfile(risks),
    highestRisk: risks[0] || null,
    riskCounts: {
      high: risks.filter(r => r.severity === 'High').length,
      medium: risks.filter(r => r.severity === 'Medium').length,
      low: risks.filter(r => r.severity === 'Low').length
    }
  };
}

function addSurchargeRisk(risks, facts, paymentsStack, industryIntelligence) {
  const surchargeRelevant =
    paymentsStack.surchargeStatus && paymentsStack.surchargeStatus !== 'Not indicated';

  if (!surchargeRelevant) return;

  risks.push({
    id: 'surcharge-reform-risk',
    type: 'Regulatory / margin planning',
    severity: 'High',
    confidence: 'Needs validation',
    observation: 'Surcharging appears relevant and surcharge rules change from 1 October 2026.',
    implication: 'The merchant may need to understand margin impact before card costs can no longer be passed through as a surcharge.',
    validation: 'Confirm current surcharge approach, surcharge rate and channel coverage.'
  });
}

function addIncompleteCostRisk(risks, paymentsStack, operationalIntelligence) {
  const gatewayGap =
    paymentsStack.stackGaps?.some(g => g.id === 'gateway-visibility') ||
    operationalIntelligence.gateway?.frictionPoints?.length;

  if (!gatewayGap) return;

  risks.push({
    id: 'incomplete-cost-risk',
    type: 'Commercial',
    severity: 'Medium',
    confidence: 'Likely',
    observation: 'Gateway costs or configuration are not fully visible in the current data.',
    implication: 'The effective rate calculated from the acquirer statement may understate the true total cost of acceptance.',
    validation: 'Request gateway invoice, gateway fee schedule or transaction export.'
  });
}

function addRoutingRisk(risks, facts, metrics) {
  const debitPct = metrics.cardMix?.debitPct ?? facts.cardMix?.debit ?? 0;
  const lcrUnknown = !facts.lcrStatus || facts.lcrStatus === 'Unknown';

  if (debitPct > 10 && lcrUnknown) {
    risks.push({
      id: 'routing-visibility-risk',
      type: 'Operational / commercial',
      severity: debitPct > 40 ? 'High' : 'Medium',
      confidence: 'Needs validation',
      observation: 'Debit volume is commercially relevant but routing configuration is not confirmed.',
      implication: 'Potential LCR savings cannot be confirmed until routing is validated by channel.',
      validation: 'Confirm LCR status across terminal, online and wallet transactions.'
    });
  }
}

function addChargebackVisibilityRisk(risks, merchantProfile, operationalIntelligence) {
  if (!operationalIntelligence.chargebacks) return;
  if (operationalIntelligence.chargebacks.visible) return;
  if (operationalIntelligence.chargebacks.riskRelevance !== 'Medium') return;

  risks.push({
    id: 'chargeback-visibility-risk',
    type: 'Operational',
    severity: 'Medium',
    confidence: 'Needs validation',
    observation: 'Chargeback data is not visible despite online/card-not-present relevance.',
    implication: 'Dispute exposure and fraud/chargeback performance cannot be assessed from the current statement alone.',
    validation: 'Request dispute, chargeback and refund reporting.'
  });
}

function addDataRisk(risks, metrics) {
  if (metrics.dataCompleteness?.level === 'Low') {
    risks.push({
      id: 'data-quality-risk',
      type: 'Data quality',
      severity: 'Medium',
      confidence: 'Confirmed',
      observation: 'Several core data points are missing or incomplete.',
      implication: 'The PIT can identify directional issues, but some opportunity values remain uncertain.',
      validation: 'Collect complete statement pages and supporting invoices.'
    });
  }
}

function addContractRisk(risks, facts, paymentsStack) {
  const hasContractData = /contract|term|expiry|renewal/i.test([
    facts.context?.raw,
    facts.observations?.join(' ')
  ].join(' '));

  if (!hasContractData) {
    risks.push({
      id: 'contract-visibility-risk',
      type: 'Contract / commercial',
      severity: 'Low',
      confidence: 'Needs validation',
      observation: 'Contract term, pass-through language and renewal position are not visible.',
      implication: 'Provider flexibility and reform pass-through cannot be fully assessed without commercial terms.',
      validation: 'Review merchant agreement, pricing schedule and renewal terms.'
    });
  }
}

function summariseRiskProfile(risks) {
  if (risks.some(r => r.severity === 'High')) return 'Material validation required';
  if (risks.some(r => r.severity === 'Medium')) return 'Some validation required';
  if (risks.length) return 'Minor visibility gaps';
  return 'No major risks visible from current data';
}

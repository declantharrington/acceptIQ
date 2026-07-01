// api/_lib/pit/commercialReasoning.js
// Commercial Reasoning Engine
// Explains why the PIT prioritised certain opportunities and what should be
// emphasised or de-emphasised.

export function buildCommercialReasoning({
  merchantProfile = {},
  paymentsStack = {},
  metrics = {},
  commercialIntelligence = {},
  operationalIntelligence = {},
  industryIntelligence = {},
  opportunities = [],
  risks = []
}) {
  const top = opportunities[0] || null;

  const reasoning = {
    primaryCommercialTheme: null,
    whyItMatters: null,
    evidenceChain: [],
    deEmphasise: [],
    priorityLogic: [],
    validationSequence: [],
    reportStoryArc: []
  };

  reasoning.evidenceChain = buildEvidenceChain({
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    operationalIntelligence,
    industryIntelligence,
    opportunities,
    risks
  });

  reasoning.primaryCommercialTheme = determinePrimaryTheme(top, {
    metrics,
    commercialIntelligence,
    paymentsStack,
    risks
  });

  reasoning.whyItMatters = explainWhyItMatters(top, {
    metrics,
    commercialIntelligence,
    paymentsStack
  });

  reasoning.priorityLogic = opportunities.slice(0, 5).map((opp, index) => ({
    rank: index + 1,
    opportunityId: opp.id,
    title: opp.title,
    reason: rationaleForOpportunity(opp, { metrics, commercialIntelligence, paymentsStack }),
    confidence: opp.confidence,
    urgency: opp.urgency,
    estimatedAnnualValue: opp.estimatedAnnualValue ?? null
  }));

  reasoning.deEmphasise = buildDeEmphasis({ commercialIntelligence, metrics, paymentsStack });

  reasoning.validationSequence = buildValidationSequence({ opportunities, risks });

  reasoning.reportStoryArc = [
    'Start with Australian payments market pressure and regulatory change.',
    'Show the merchant their current commercial position.',
    'Explain what is visible in the stack and where confidence is limited.',
    'Explore only the diagnostic modules that are relevant to this merchant.',
    'Summarise the priority opportunities and what should be validated next.'
  ];

  return reasoning;
}

function buildEvidenceChain({
  merchantProfile,
  paymentsStack,
  metrics,
  commercialIntelligence,
  operationalIntelligence,
  industryIntelligence,
  opportunities,
  risks
}) {
  const chain = [];

  if (merchantProfile.sizeSegment) {
    chain.push(`Merchant segment: ${merchantProfile.sizeSegment}`);
  }

  if (paymentsStack.pricingModel) {
    chain.push(`Pricing model: ${paymentsStack.pricingModel}`);
  }

  if (metrics.effectiveRate != null) {
    chain.push(`Effective rate: ${metrics.effectiveRate}%`);
  }

  if (metrics.cardMix?.debitPct != null) {
    chain.push(`Debit mix: ${metrics.cardMix.debitPct}%`);
  }

  if (commercialIntelligence.providerMargin?.position) {
    chain.push(`Provider margin position: ${commercialIntelligence.providerMargin.position}`);
  }

  if (industryIntelligence.reforms?.length) {
    chain.push(`Relevant reforms: ${industryIntelligence.reforms.map(r => r.name).join(', ')}`);
  }

  if (risks?.length) {
    chain.push(`Risk profile: ${risks[0].type}`);
  }

  if (opportunities?.length) {
    chain.push(`Top opportunity: ${opportunities[0].title}`);
  }

  return chain;
}

function determinePrimaryTheme(top, context) {
  if (!top) return 'The current data supports a payments review, but more information would improve confidence.';

  if (top.id === 'least-cost-routing') {
    return 'Debit routing appears to be the most important validation area.';
  }

  if (top.id === 'october-reform') {
    return 'Upcoming interchange reform is the clearest commercial catalyst.';
  }

  if (top.id === 'surcharge-planning') {
    return 'Surcharge reform creates a margin planning priority.';
  }

  if (top.id === 'pricing-structure') {
    return 'Pricing structure and provider margin are the key commercial areas to validate.';
  }

  return `${top.title} appears to be the most relevant commercial theme.`;
}

function explainWhyItMatters(top, { metrics, commercialIntelligence, paymentsStack }) {
  if (!top) {
    return 'The PIT has identified partial intelligence, but additional data would improve opportunity sizing.';
  }

  if (top.id === 'least-cost-routing') {
    return 'Debit volume is material and LCR status is not confirmed, so routing may matter more than provider margin or headline pricing.';
  }

  if (top.id === 'october-reform') {
    return 'Credit volume is visible and the reform has a confirmed start date, making pass-through validation commercially important.';
  }

  if (top.id === 'surcharge-planning') {
    return 'The merchant appears to surcharge and the rules change in October 2026, so future margin treatment should be understood before the change takes effect.';
  }

  if (top.id === 'pricing-structure') {
    return 'Pricing structure determines whether wholesale reductions, provider margin and routing benefits are visible and able to be validated.';
  }

  return 'This opportunity is relevant based on the current evidence and should be validated with additional data.';
}

function rationaleForOpportunity(opp, { metrics, commercialIntelligence, paymentsStack }) {
  if (opp.id === 'least-cost-routing') {
    return 'Prioritised because debit mix is commercially relevant and routing status is not confirmed.';
  }

  if (opp.id === 'october-reform') {
    return 'Prioritised because the regulatory change is confirmed and credit volume is visible.';
  }

  if (opp.id === 'surcharge-planning') {
    return 'Prioritised because surcharge removal has a confirmed date and affects pricing/margin planning.';
  }

  if (opp.id === 'pricing-structure') {
    return 'Included because pricing structure determines transparency and whether savings can be verified.';
  }

  return 'Included because the available evidence indicates commercial relevance.';
}

function buildDeEmphasis({ commercialIntelligence, metrics, paymentsStack }) {
  const out = [];

  if (commercialIntelligence.providerMargin?.position === 'Competitive') {
    out.push('Do not over-focus on provider margin if it already appears commercially lean.');
  }

  if (metrics.effectiveRate != null && metrics.effectiveRate <= 0.75) {
    out.push('Do not frame the entire position as expensive if the effective rate is already competitive.');
  }

  if (!metrics.feeComposition) {
    out.push('Avoid over-interpreting fee composition until detailed fee lines are available.');
  }

  return out;
}

function buildValidationSequence({ opportunities, risks }) {
  const sequence = [];

  for (const opp of opportunities.slice(0, 4)) {
    if (opp.dependencies?.length) {
      sequence.push({
        opportunityId: opp.id,
        title: opp.title,
        validate: opp.dependencies
      });
    }
  }

  for (const risk of risks.slice(0, 3)) {
    if (risk.validation) {
      sequence.push({
        riskId: risk.id,
        title: risk.type,
        validate: [risk.validation]
      });
    }
  }

  return sequence;
}

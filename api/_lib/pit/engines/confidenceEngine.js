// api/_lib/pit/engines/confidenceEngine.js
// Confidence Engine
// Computes confidence by intelligence area without creating arbitrary merchant scores.

export function buildConfidenceProfile({ facts = {}, metrics = {}, paymentsStack = {}, dataQuality = {}, observations = [], understandings = [], priorities = [] }) {
  const profile = {
    merchantProfile: confidenceFromChecks([
      !!facts.context?.company,
      !!facts.context?.industry || !!facts.context?.businessType,
      !!facts.context?.monthlyCardVolume
    ]),
    paymentsStack: confidenceFromChecks([
      !!paymentsStack.acquirerOrProvider,
      !!paymentsStack.pricingModel && paymentsStack.pricingModel !== 'Unknown',
      !!paymentsStack.gateway || !requiresGateway(facts),
      !!facts.lcrStatus && facts.lcrStatus !== 'Unknown'
    ]),
    commercialPosition: confidenceFromChecks([
      !!metrics.volume,
      !!metrics.totalFees,
      !!metrics.effectiveRate,
      !!metrics.feeComposition,
      !!facts.providerRate
    ]),
    routing: confidenceFromChecks([
      metrics.cardMix?.debitPct != null,
      !!facts.lcrStatus && facts.lcrStatus !== 'Unknown'
    ]),
    operationalRisk: confidenceFromChecks([
      !!facts.chargebacks,
      paymentsStack.gateway || !requiresGateway(facts),
      dataQuality.qualityLevel === 'High'
    ]),
    opportunityRanking: confidenceFromChecks([
      observations.length >= 5,
      understandings.length >= 1,
      priorities.length >= 1,
      dataQuality.qualityLevel !== 'Low'
    ])
  };

  profile.overall = summarise(profile);
  return profile;
}

function confidenceFromChecks(checks) {
  const total = checks.length || 1;
  const passed = checks.filter(Boolean).length;
  const ratio = passed / total;
  if (ratio >= 0.8) return 'High';
  if (ratio >= 0.5) return 'Medium';
  return 'Low';
}

function summarise(profile) {
  const values = Object.values(profile);
  const high = values.filter(v => v === 'High').length;
  const low = values.filter(v => v === 'Low').length;
  if (low >= 2) return 'Medium-Low';
  if (high >= 4) return 'High';
  return 'Medium';
}

function requiresGateway(facts) {
  const text = [
    facts.context?.raw,
    facts.observations?.join(' '),
    facts.setup?.map(x => `${x.label} ${x.value}`).join(' ')
  ].join(' ');
  return /online|gateway|ecommerce|e-commerce|card-not-present|cnp/i.test(text);
}

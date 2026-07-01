// api/_lib/pit/engines/understandingEngine.js
// Commercial Understanding Engine
// Combines observations into higher-order commercial conclusions.

function hasObs(observations, id) {
  return observations.some(o => o.id === id);
}

function obsById(observations, id) {
  return observations.find(o => o.id === id);
}

export function buildCommercialUnderstanding({ observations = [], opportunities = [], metrics = {}, commercialIntelligence = {} }) {
  const understandings = [];

  const pricingLean = obsById(observations, 'OBS-PRICING-002')?.severity === 'Positive';
  const effectiveCompetitive = obsById(observations, 'OBS-PRICING-003')?.severity === 'Positive';
  const debitMaterial = ['High', 'Medium'].includes(obsById(observations, 'OBS-ROUTING-001')?.severity);
  const lcrUnverified = hasObs(observations, 'OBS-ROUTING-002') && obsById(observations, 'OBS-ROUTING-002')?.severity !== 'Positive';
  const reformRelevant = hasObs(observations, 'OBS-REFORM-001');
  const surchargeRelevant = hasObs(observations, 'OBS-REFORM-002');
  const gatewayGap = hasObs(observations, 'OBS-STACK-002');
  const contractMissing = obsById(observations, 'OBS-CONTRACT-001')?.title === 'Contract terms are not visible';

  if ((pricingLean || effectiveCompetitive) && debitMaterial && lcrUnverified) {
    understandings.push({
      id: 'UND-001',
      title: 'Routing should be prioritised over headline repricing',
      conclusion: 'The available evidence suggests the merchant may already have a competitive pricing position, making debit routing a more important validation area than provider margin negotiation.',
      confidence: pricingLean && debitMaterial ? 'High' : 'Medium',
      dependsOn: ['OBS-PRICING-002', 'OBS-PRICING-003', 'OBS-ROUTING-001', 'OBS-ROUTING-002'],
      evidence: observations.filter(o => ['OBS-PRICING-002', 'OBS-PRICING-003', 'OBS-ROUTING-001', 'OBS-ROUTING-002'].includes(o.id)).flatMap(o => o.evidence || []),
      businessImpact: 'Focuses analyst attention on the area most likely to produce incremental value.'
    });
  }

  if (reformRelevant && contractMissing) {
    understandings.push({
      id: 'UND-002',
      title: 'Reform value depends on pass-through certainty',
      conclusion: 'October 2026 interchange reform is relevant, but the merchant agreement or pricing schedule is needed to confirm how savings flow through.',
      confidence: 'Medium',
      dependsOn: ['OBS-REFORM-001', 'OBS-CONTRACT-001'],
      evidence: observations.filter(o => ['OBS-REFORM-001', 'OBS-CONTRACT-001'].includes(o.id)).flatMap(o => o.evidence || []),
      businessImpact: 'Separates the regulatory opportunity from the contractual uncertainty.'
    });
  }

  if (surchargeRelevant && reformRelevant) {
    understandings.push({
      id: 'UND-003',
      title: 'Surcharge reform should be considered with interchange reform',
      conclusion: 'Surcharge removal may increase absorbed card costs, while interchange reform may reduce some of those costs. The net impact should be modelled together.',
      confidence: 'Medium',
      dependsOn: ['OBS-REFORM-001', 'OBS-REFORM-002'],
      evidence: observations.filter(o => ['OBS-REFORM-001', 'OBS-REFORM-002'].includes(o.id)).flatMap(o => o.evidence || []),
      businessImpact: 'Helps avoid treating surcharge removal as a standalone issue.'
    });
  }

  if (gatewayGap) {
    understandings.push({
      id: 'UND-004',
      title: 'The current cost view may be incomplete',
      conclusion: 'The merchant’s acquirer statement may not include all gateway or online acceptance costs, so true cost of acceptance may be higher than the visible effective rate.',
      confidence: 'Likely',
      dependsOn: ['OBS-STACK-002'],
      evidence: observations.filter(o => o.id === 'OBS-STACK-002').flatMap(o => o.evidence || []),
      businessImpact: 'Prevents the PIT from overclaiming savings or benchmark position from incomplete data.'
    });
  }

  if (!understandings.length) {
    understandings.push({
      id: 'UND-000',
      title: 'Current data supports a directional payments review',
      conclusion: 'The PIT has enough data to produce a useful diagnostic, but additional stack, contract or operational data would improve confidence.',
      confidence: 'Medium',
      dependsOn: observations.slice(0, 4).map(o => o.id),
      evidence: observations.slice(0, 4).flatMap(o => o.evidence || []),
      businessImpact: 'Sets the review up as a validation-led exercise rather than a prescriptive recommendation.'
    });
  }

  return understandings;
}

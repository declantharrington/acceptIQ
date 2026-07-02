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

  // New pattern flags from the expanded rule set
  const intlMaterial = ['High', 'Medium'].includes(obsById(observations, 'OBS-INTL-001')?.severity);
  const intlReformExcluded = hasObs(observations, 'OBS-INTL-002');
  const amexMaterial = ['High', 'Medium'].includes(obsById(observations, 'OBS-AMEX-001')?.severity);
  const amexReformExcluded = hasObs(observations, 'OBS-AMEX-002');
  const disputeHigh = ['High'].includes(obsById(observations, 'OBS-DISPUTE-001')?.severity);
  const authFeesPresent = hasObs(observations, 'OBS-AUTH-001');
  const digitalFeesPresent = hasObs(observations, 'OBS-DIGITAL-001');
  const txnFeeStructure = hasObs(observations, 'OBS-TXN-001');

  // Pattern flags from Priority 1/2/4 rule set
  const aggregatorDetected = hasObs(observations, 'OBS-ACQUIRER-001');
  const directAcquirer = hasObs(observations, 'OBS-ACQUIRER-002');
  const bnplPresent = hasObs(observations, 'OBS-BNPL-001');
  const bnplReformInteraction = hasObs(observations, 'OBS-BNPL-002');
  const motoLiability = hasObs(observations, 'OBS-ACCEPTANCE-003');
  const cnp3DSGap = hasObs(observations, 'OBS-ACCEPTANCE-004');
  const authRateLow = obsById(observations, 'OBS-ACCEPTANCE-001')?.severity === 'High';
  const foreignReform2027 = hasObs(observations, 'OBS-REFORM-003');
  const surchargeStrategy = hasObs(observations, 'OBS-REFORM-002');
  const recurringGap = hasObs(observations, 'OBS-RECURRING-001');
  const dccPresent = hasObs(observations, 'OBS-DCC-001');

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


  // New understandings from expanded rule set

  if ((intlMaterial || amexMaterial) && (intlReformExcluded || amexReformExcluded)) {
    const exclusions = [
      intlMaterial && intlReformExcluded ? 'international cards' : null,
      amexMaterial && amexReformExcluded ? 'AMEX' : null
    ].filter(Boolean);
    understandings.push({
      id: 'UND-005',
      title: `Reform savings estimate may overstate benefit due to ${exclusions.join(' and ')} exclusions`,
      conclusion: `The October 2026 interchange reform applies only to domestic Australian-issued consumer credit cards. ${exclusions.join(' and ')} volume is excluded from this benefit. The headline reform saving should be understood as applying to the eligible domestic credit card portion only.`,
      confidence: 'High',
      dependsOn: [
        intlReformExcluded ? 'OBS-INTL-002' : null,
        amexReformExcluded ? 'OBS-AMEX-002' : null,
        'OBS-REFORM-001'
      ].filter(Boolean),
      evidence: observations
        .filter(o => ['OBS-INTL-002', 'OBS-AMEX-002', 'OBS-REFORM-001'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Ensures reform savings are not overstated in the commercial analysis.'
    });
  }

  if (authFeesPresent && digitalFeesPresent) {
    understandings.push({
      id: 'UND-006',
      title: 'Digital payment infrastructure costs form a meaningful second cost layer',
      conclusion: 'Beyond the headline MSF and interchange, this merchant carries a visible layer of per-transaction digital costs (3DS authentication, network tokenisation, digital wallet fees). These costs are largely fixed per transaction and do not scale favourably with volume.',
      confidence: 'Confirmed',
      dependsOn: ['OBS-AUTH-001', 'OBS-DIGITAL-001'],
      evidence: observations
        .filter(o => ['OBS-AUTH-001', 'OBS-DIGITAL-001'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Frames the cost review around total cost of acceptance rather than the MSF alone.'
    });
  }

  if (disputeHigh) {
    understandings.push({
      id: 'UND-007',
      title: 'Dispute management is an immediate priority independent of pricing',
      conclusion: 'The chargeback ratio or cost profile indicates dispute management should be addressed as a standalone priority. Provider pricing changes will not improve dispute exposure.',
      confidence: 'High',
      dependsOn: ['OBS-DISPUTE-001'],
      evidence: observations
        .filter(o => o.id === 'OBS-DISPUTE-001')
        .flatMap(o => o.evidence || []),
      businessImpact: 'Separates dispute risk from pricing opportunity so both are addressed appropriately.'
    });
  }

  if (txnFeeStructure && obsById(observations, 'OBS-TXN-001')?.severity === 'High') {
    understandings.push({
      id: 'UND-008',
      title: "Per-transaction fee structure is disproportionate to this merchant's ATV",
      conclusion: "The combination of per-transaction fees and this merchant's average ticket value creates a structurally punitive cost profile. A percentage-based or lower fixed-fee structure would be more appropriate for this transaction profile.",
      confidence: 'Likely',
      dependsOn: ['OBS-TXN-001'],
      evidence: observations
        .filter(o => o.id === 'OBS-TXN-001')
        .flatMap(o => o.evidence || []),
      businessImpact: 'Identifies a structural pricing mismatch that compounds at volume.'
    });
  }

  // New understandings from Priority 1/2/4 rule set

  if (aggregatorDetected && (metrics.volume && metrics.volume * 12 > 300000)) {
    understandings.push({
      id: 'UND-009',
      title: 'Moving to a direct acquirer is the primary commercial lever at this volume',
      conclusion: 'The merchant is on a PSP/aggregator with non-negotiable pricing. At this volume, a direct acquiring relationship would provide lower effective rates, interchange visibility, and commercial negotiation leverage. This is likely to be the highest-value structural change available.',
      confidence: 'High',
      dependsOn: ['OBS-ACQUIRER-001'],
      evidence: observations.filter(o => o.id === 'OBS-ACQUIRER-001').flatMap(o => o.evidence || []),
      businessImpact: 'Identifies the single highest-value commercial pathway for aggregator merchants at scale.'
    });
  }

  if ((motoLiability || cnp3DSGap) && disputeHigh) {
    understandings.push({
      id: 'UND-010',
      title: 'CNP liability exposure and dispute costs are linked — address both together',
      conclusion: 'The merchant has both CNP acceptance without full authentication coverage and elevated chargeback activity. These are likely related: unauthenticated CNP transactions bear full merchant fraud liability, and disputes on these transactions are difficult to win.',
      confidence: 'High',
      dependsOn: [
        motoLiability ? 'OBS-ACCEPTANCE-003' : null,
        cnp3DSGap ? 'OBS-ACCEPTANCE-004' : null,
        'OBS-DISPUTE-001'
      ].filter(Boolean),
      evidence: observations
        .filter(o => ['OBS-ACCEPTANCE-003', 'OBS-ACCEPTANCE-004', 'OBS-DISPUTE-001'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Frames CNP authentication and dispute management as a single interconnected priority rather than separate issues.'
    });
  }

  if (bnplPresent && surchargeStrategy) {
    understandings.push({
      id: 'UND-011',
      title: 'BNPL and surcharge removal create a combined cost absorption challenge',
      conclusion: 'This merchant faces two converging cost pressures from October 2026: surcharge removal (card costs must be absorbed) and continued BNPL MDR (which is higher than card costs). The combined impact should be modelled as a single P&L scenario, not addressed separately.',
      confidence: 'High',
      dependsOn: ['OBS-BNPL-001', 'OBS-REFORM-002'],
      evidence: observations
        .filter(o => ['OBS-BNPL-001', 'OBS-REFORM-002'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Prevents fragmented treatment of two regulatory changes that have a compounding commercial impact.'
    });
  }

  if (foreignReform2027 && reformRelevant) {
    understandings.push({
      id: 'UND-012',
      title: 'Two separate reform waves apply — October 2026 (domestic) and April 2027 (foreign)',
      conclusion: 'This merchant benefits from both reform waves. The October 2026 domestic interchange cap and the April 2027 foreign card interchange alignment are separate events with separate pass-through considerations and separate timelines. Planning should account for both.',
      confidence: 'Confirmed',
      dependsOn: ['OBS-REFORM-001', 'OBS-REFORM-003'],
      evidence: observations
        .filter(o => ['OBS-REFORM-001', 'OBS-REFORM-003'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Ensures the full reform benefit (both waves) is captured in planning, not just the more widely known October 2026 domestic change.'
    });
  }

  if (recurringGap && authRateLow) {
    understandings.push({
      id: 'UND-013',
      title: 'Low authorisation rate in a recurring billing context suggests credential management gaps',
      conclusion: 'The combination of recurring billing and a below-benchmark authorisation rate strongly suggests involuntary payment failures from stale stored credentials (expired or replaced cards). This is avoidable revenue loss, not a pricing problem.',
      confidence: 'Likely',
      dependsOn: ['OBS-RECURRING-001', 'OBS-ACCEPTANCE-001'],
      evidence: observations
        .filter(o => ['OBS-RECURRING-001', 'OBS-ACCEPTANCE-001'].includes(o.id))
        .flatMap(o => o.evidence || []),
      businessImpact: 'Identifies a revenue recovery opportunity that is independent of pricing and addressable through Account Updater or network tokenisation.'
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

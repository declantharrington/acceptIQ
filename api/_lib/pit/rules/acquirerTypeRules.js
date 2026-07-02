// api/_lib/pit/rules/acquirerTypeRules.js
// Observation rules for acquirer type: PSP/aggregator vs direct acquirer.
//
// This is one of the most commercially important structural distinctions in
// Australian payments. Aggregators (PayPal, Square, Stripe, Tyro for some
// categories, Pin Payments) provide a simplified onboarding experience but
// at significantly higher effective rates at scale, with no interchange
// visibility and no ability to negotiate pricing directly.
//
// Direct acquirers (Commonwealth Bank, Westpac, ANZ, NAB, Bendigo, Tyro
// as a direct acquirer, Fiserv/First Data, Global Payments, Windcave)
// provide competitive rates at volume, interchange transparency on IC++,
// and contractual pricing flexibility.
//
// The distinction matters because:
//   1. The commercial levers available are fundamentally different
//   2. Aggregator pricing is non-negotiable; direct acquirer pricing is
//   3. The PIT's savings calculations assume a direct acquiring relationship

import { factEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

// Known Australian PSP/aggregator providers
const AGGREGATORS = [
  'paypal', 'square', 'stripe', 'pin payments', 'pinpayments',
  'afterpay', 'zip', 'klarna', 'braintree', 'shopify payments',
  'sumup', 'zettle', 'izettle', 'paynow', 'zippay'
];

// Known Australian direct acquirers
const DIRECT_ACQUIRERS = [
  'commonwealth bank', 'cba', 'commbank',
  'westpac', 'st george', 'bank of melbourne', 'bsa',
  'anz', 'australia and new zealand',
  'nab', 'national australia bank',
  'bendigo bank', 'bank of bendigo',
  'tyro', 'fiserv', 'first data', 'global payments',
  'windcave', 'payment express', 'adyen', 'worldline',
  'red star bank', 'beyond bank', 'bankwest', 'suncorp',
  'heritage bank', 'people\'s choice'
];

function detectAcquirerType(providerName, facts) {
  const name = (providerName || '').toLowerCase();
  const allText = [
    name,
    (facts.observations || []).join(' ').toLowerCase(),
    (facts.setup || []).map(s => `${s.label} ${s.value}`).join(' ').toLowerCase(),
    (facts.context?.raw || '').toLowerCase()
  ].join(' ');

  // Check for aggregator indicators
  for (const agg of AGGREGATORS) {
    if (allText.includes(agg)) return { type: 'aggregator', detected: agg };
  }

  // Check explicit aggregator language
  if (/aggregator|payment facilitator|payfac|payment service provider|psp/i.test(allText)) {
    return { type: 'aggregator', detected: 'PSP/aggregator language' };
  }

  // Check for direct acquirer indicators
  for (const acq of DIRECT_ACQUIRERS) {
    if (name.includes(acq) || allText.includes(acq)) {
      return { type: 'direct', detected: acq };
    }
  }

  // Check for IC++ on statement (strong signal of direct acquirer)
  const icpp = /interchange.plus.plus|ic\+\+/i.test(facts.pricingModel || '');
  if (icpp) return { type: 'direct', detected: 'IC++ pricing model (direct acquirer indicator)' };

  return { type: 'unknown', detected: null };
}

export function acquirerTypeObservationRules(ctx) {
  const { facts = {}, metrics = {}, merchantProfile = {} } = ctx;
  const rules = [];

  // ── Rule 1: Merchant appears to be on an aggregator/PSP ──────────────────
  rules.push(() => {
    const { type, detected } = detectAcquirerType(facts.provider, facts);
    if (type !== 'aggregator') return null;

    const effectiveRate = metrics.effectiveRate;
    const volume = metrics.volume;
    const annualVolume = volume ? volume * 12 : null;

    // At what volume does a merchant typically outgrow aggregator pricing?
    // Rough threshold: ~$300k/year where direct acquiring becomes cheaper
    const outgrown = annualVolume && annualVolume > 300000;

    return {
      id: 'OBS-ACQUIRER-001',
      category: 'Acquirer type',
      title: `Merchant appears to be on a PSP/aggregator (${detected})`,
      observation: `The provider appears to be a payment service provider or aggregator rather than a direct acquirer. Aggregator pricing is typically fixed and non-negotiable, does not separate interchange from the platform margin, and may limit the commercial levers available.${effectiveRate ? ` Current effective rate: ${effectiveRate}%.` : ''}${outgrown ? ` At an annualised volume of ~$${Math.round(annualVolume).toLocaleString('en-AU')}, this merchant may have outgrown aggregator pricing.` : ''}`,
      confidence: 'Likely',
      severity: outgrown ? 'High' : 'Medium',
      evidence: [
        factEvidence('Provider', facts.provider || detected),
        effectiveRate ? factEvidence('Effective rate', `${effectiveRate}%`) : null,
        annualVolume ? factEvidence('Annualised volume (estimated)', `$${Math.round(annualVolume).toLocaleString('en-AU')}`) : null,
        kbEvidence('Aggregators/PSPs provide simplified onboarding but fixed pricing. Direct acquirers offer negotiated rates and interchange transparency at scale.'),
        ruleEvidence('acquirer-type-aggregator', 'Provider identified as PSP/aggregator from name and pricing signals')
      ].filter(Boolean),
      commercialImplication: outgrown
        ? 'At this volume, moving to a direct acquirer relationship would likely reduce the effective rate materially, provide interchange visibility, and unlock commercial negotiation. This is the primary opportunity to explore.'
        : 'Aggregator pricing may be appropriate at current volume. Monitor as volume grows — the crossover point where direct acquiring is cheaper is typically $250k–$400k per year.'
    };
  });

  // ── Rule 2: Direct acquirer confirmed — pricing levers available ──────────
  rules.push(() => {
    const { type, detected } = detectAcquirerType(facts.provider, facts);
    if (type !== 'direct') return null;

    // Only surface as a positive observation if the effective rate is elevated
    // (no need to flag "you have a direct acquirer" if everything looks fine)
    const rateElevated = metrics.effectiveRate && metrics.effectiveRate > 1.4;
    if (!rateElevated) return null;

    return {
      id: 'OBS-ACQUIRER-002',
      category: 'Acquirer type',
      title: 'Direct acquirer relationship confirmed — pricing is negotiable',
      observation: `The merchant has a direct acquiring relationship with ${facts.provider || detected}. Direct acquirer pricing is contractual and negotiable, unlike PSP/aggregator pricing. The current effective rate of ${metrics.effectiveRate}% may be improved through direct commercial engagement.`,
      confidence: 'Confirmed',
      severity: 'Medium',
      evidence: [
        factEvidence('Provider', facts.provider || detected),
        factEvidence('Effective rate', `${metrics.effectiveRate}%`),
        kbEvidence('Direct acquirer pricing is contractually negotiable. Merchants with direct relationships can request repricing, particularly when benchmarked against market rates.'),
        ruleEvidence('acquirer-type-direct', 'Direct acquirer confirmed — commercial repricing pathway exists')
      ],
      commercialImplication: 'A direct acquirer relationship means pricing can be renegotiated. The current rate and fee structure should be formally benchmarked and, if above market, a repricing conversation is warranted.'
    };
  });

  // ── Rule 3: Acquirer type cannot be determined ────────────────────────────
  rules.push(() => {
    const { type } = detectAcquirerType(facts.provider, facts);
    if (type !== 'unknown') return null;
    if (!facts.provider) return null; // No provider at all — handled elsewhere

    return {
      id: 'OBS-ACQUIRER-003',
      category: 'Acquirer type',
      title: 'Acquirer type cannot be determined from available data',
      observation: `Provider "${facts.provider}" is not recognised as a known direct acquirer or aggregator. The commercial levers available depend on whether this is a direct acquirer relationship or an aggregator arrangement.`,
      confidence: 'Needs validation',
      severity: 'Low',
      evidence: [
        factEvidence('Provider', facts.provider),
        ruleEvidence('acquirer-type-unknown', 'Provider not matched to known acquirer or aggregator list')
      ],
      commercialImplication: 'Confirm whether the merchant has a direct acquiring agreement or is sub-merchant under an aggregator. This determines whether pricing can be negotiated and which commercial pathways are available.'
    };
  });

  return rules;
}

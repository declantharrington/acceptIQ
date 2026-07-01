// api/_lib/pit/rules/pricingRules.js
// Commercial observation rules for pricing, margin and cost structure.

import { factEvidence, metricEvidence, ruleEvidence } from '../engines/evidenceEngine.js';

const pct = v => Number(v);

function providerRateNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function pricingObservationRules(ctx) {
  const { facts = {}, metrics = {}, commercialIntelligence = {} } = ctx;
  const rules = [];

  rules.push(() => {
    const model = facts.pricingModel || commercialIntelligence.pricingModel?.model;
    if (!model || model === 'Unknown') return null;
    const isTransparent = /interchange-plus|interchange-plus-plus|ic\+|ic\+\+/i.test(model);
    return {
      id: 'OBS-PRICING-001',
      category: 'Pricing',
      title: isTransparent ? 'Pricing structure appears transparent' : 'Pricing structure may limit cost visibility',
      observation: isTransparent
        ? 'The merchant appears to be on an unblended pricing model, which improves visibility of wholesale cost and provider margin.'
        : 'The merchant may be on a blended or less transparent pricing structure, which can make wholesale savings harder to verify.',
      confidence: 'Confirmed',
      severity: isTransparent ? 'Positive' : 'Medium',
      evidence: [
        factEvidence('Pricing model', model),
        ruleEvidence('pricing-transparent-model', 'Pricing transparency inferred from pricing model')
      ],
      commercialImplication: isTransparent
        ? 'Provider margin and wholesale pass-through can be validated more directly.'
        : 'The merchant may need pricing decomposition before commercial opportunities can be fully assessed.'
    };
  });

  rules.push(() => {
    const rate = providerRateNumber(facts.providerRate);
    if (rate == null) return null;
    let title = 'Provider margin requires validation';
    let severity = 'Medium';
    let implication = 'Provider margin should be validated against comparable merchants and full cost stack.';
    if (rate <= 0.15) {
      title = 'Provider margin appears commercially lean';
      severity = 'Positive';
      implication = 'Large savings are less likely to come from provider margin alone; routing, reform and stack configuration may matter more.';
    } else if (rate > 0.30) {
      title = 'Provider margin may warrant commercial review';
      severity = 'High';
      implication = 'Provider margin could be a meaningful commercial lever if confirmed across all transaction types.';
    }
    return {
      id: 'OBS-PRICING-002',
      category: 'Pricing',
      title,
      observation: `Provider margin is observed as ${facts.providerRate}.`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        factEvidence('Provider margin', facts.providerRate),
        ruleEvidence('provider-margin-bands', 'Provider margin compared with PIT commercial bands')
      ],
      commercialImplication: implication
    };
  });

  rules.push(() => {
    if (metrics.effectiveRate == null) return null;
    let title = 'Effective rate is above common benchmark range';
    let severity = 'High';
    let implication = 'Pricing and cost structure should be reviewed carefully.';
    if (metrics.effectiveRate <= 0.75) {
      title = 'Effective rate appears commercially competitive';
      severity = 'Positive';
      implication = 'The merchant should avoid assuming the headline rate is the main issue; remaining value may sit in routing, reform pass-through or missing stack costs.';
    } else if (metrics.effectiveRate <= 0.95) {
      title = 'Effective rate sits within a reasonable unblended range';
      severity = 'Low';
      implication = 'The merchant should validate cost drivers rather than focus only on headline rate reduction.';
    }
    return {
      id: 'OBS-PRICING-003',
      category: 'Pricing',
      title,
      observation: `Effective rate is ${metrics.effectiveRate}%.`,
      confidence: 'Estimated',
      severity,
      evidence: [
        metricEvidence('Effective rate', `${metrics.effectiveRate}%`),
        ruleEvidence('effective-rate-bands', 'Effective rate compared with PIT benchmark bands')
      ],
      commercialImplication: implication
    };
  });

  rules.push(() => {
    const fc = metrics.feeComposition;
    if (!fc) return null;
    const drivers = [
      ['Interchange', fc.interchangePct],
      ['Scheme fees', fc.schemePct],
      ['Provider margin / other', fc.providerMarginPct]
    ].sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
    const top = drivers[0];
    return {
      id: 'OBS-PRICING-004',
      category: 'Cost structure',
      title: `${top[0]} is the largest visible cost driver`,
      observation: `${top[0]} represents approximately ${top[1]}% of visible fees.`,
      confidence: 'Estimated',
      severity: top[0] === 'Provider margin / other' ? 'Medium' : 'Low',
      evidence: [
        metricEvidence('Fee composition', `${top[0]} ${top[1]}%`),
        ruleEvidence('largest-fee-driver', 'Largest fee component selected from fee composition')
      ],
      commercialImplication: top[0] === 'Interchange'
        ? 'Regulatory pass-through and card mix are likely to matter more than provider margin alone.'
        : top[0] === 'Scheme fees'
          ? 'Network fees should be monitored, but may not be directly negotiable.'
          : 'Provider-controlled cost may warrant a commercial pricing review.'
    };
  });

  return rules;
}

// api/_lib/pit/rules/reformRules.js
// Observation rules for Australian payments reforms and regulatory change.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

export function reformObservationRules(ctx) {
  const { facts = {}, metrics = {}, industryIntelligence = {} } = ctx;
  const rules = [];

  rules.push(() => {
    const creditPct = metrics.cardMix?.creditPct ?? facts.cardMix?.credit;
    if (!creditPct || Number(creditPct) <= 0) return null;
    return {
      id: 'OBS-REFORM-001',
      category: 'Industry reform',
      title: 'October 2026 credit interchange reform is relevant',
      observation: `Credit represents ${creditPct}% of visible card volume.`,
      confidence: metrics.reformSavings ? 'Estimated' : 'Needs validation',
      severity: metrics.reformSavings?.annual >= 10000 ? 'High' : 'Medium',
      evidence: [
        metricEvidence('Credit mix', `${creditPct}%`, 'Confirmed'),
        metrics.reformSavings ? metricEvidence('Estimated reform saving', `$${metrics.reformSavings.annual}/yr`, 'Estimated') : null,
        kbEvidence('Consumer credit interchange cap falls to 0.30% from 1 October 2026')
      ].filter(Boolean),
      commercialImplication: 'Provider pass-through and consumer/commercial card split should be validated before the reform date.'
    };
  });

  rules.push(() => {
    const text = [
      facts.context?.surcharge,
      facts.context?.raw,
      facts.observations?.join(' ')
    ].join(' ');
    if (!/surcharge|surcharging/i.test(text)) return null;
    return {
      id: 'OBS-REFORM-002',
      category: 'Industry reform',
      title: 'Surcharge removal creates a planning requirement',
      observation: 'Surcharging appears relevant from the questionnaire or statement observations.',
      confidence: 'Needs validation',
      severity: 'High',
      evidence: [
        factEvidence('Surcharge relevance', 'Detected'),
        kbEvidence('Card surcharging removed from 1 October 2026')
      ],
      commercialImplication: 'The merchant should understand the net margin impact of absorbing card costs after surcharge removal.'
    };
  });

  return rules;
}

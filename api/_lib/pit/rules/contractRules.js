// api/_lib/pit/rules/contractRules.js
// Observation rules for contract and commercial term visibility.

import { factEvidence, ruleEvidence } from '../engines/evidenceEngine.js';

export function contractObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  rules.push(() => {
    const text = [
      facts.context?.raw,
      facts.observations?.join(' ')
    ].join(' ');

    if (/contract|agreement|term|expiry|renewal|pass-through|passthrough/i.test(text)) {
      return {
        id: 'OBS-CONTRACT-001',
        category: 'Contract',
        title: 'Contract terms may be available for review',
        observation: 'Contract-related language appears in the supplied context.',
        confidence: 'Likely',
        severity: 'Low',
        evidence: [factEvidence('Contract context', 'Detected')],
        commercialImplication: 'Commercial terms can be assessed if the agreement or pricing schedule is provided.'
      };
    }

    return {
      id: 'OBS-CONTRACT-001',
      category: 'Contract',
      title: 'Contract terms are not visible',
      observation: 'The PIT cannot see agreement term, renewal date or pass-through language.',
      confidence: 'Confirmed',
      severity: metrics.reformSavings ? 'Medium' : 'Low',
      evidence: [
        factEvidence('Contract data', 'Not supplied'),
        ruleEvidence('contract-visibility', 'Contract visibility required for pass-through and renewal analysis')
      ],
      commercialImplication: 'Reform pass-through and renewal leverage cannot be fully assessed without the merchant agreement or pricing schedule.'
    };
  });

  return rules;
}

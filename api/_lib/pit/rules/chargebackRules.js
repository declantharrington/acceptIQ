// api/_lib/pit/rules/chargebackRules.js
// Observation rules for chargeback and dispute visibility.

import { factEvidence, ruleEvidence } from '../engines/evidenceEngine.js';

export function chargebackObservationRules(ctx) {
  const { facts = {}, merchantProfile = {}, operationalIntelligence = {} } = ctx;
  const rules = [];

  rules.push(() => {
    if (facts.chargebacks) {
      return {
        id: 'OBS-CHARGEBACK-001',
        category: 'Chargebacks',
        title: 'Chargeback data is visible',
        observation: 'Chargeback fields are populated from the statement.',
        confidence: 'Confirmed',
        severity: facts.chargebacks.ratio > 0.65 ? 'High' : 'Low',
        evidence: [
          factEvidence('Chargeback count', facts.chargebacks.count),
          factEvidence('Chargeback ratio', facts.chargebacks.ratio)
        ],
        commercialImplication: 'Dispute performance can be assessed from current data.'
      };
    }

    const online = /online|card-not-present|cnp|omnichannel/i.test([
      merchantProfile.businessModel,
      merchantProfile.channelProfile
    ].join(' '));

    return {
      id: 'OBS-CHARGEBACK-001',
      category: 'Chargebacks',
      title: online ? 'Chargeback visibility is missing for an online-relevant merchant' : 'Chargeback data is not visible',
      observation: 'The statement does not show chargeback activity or dispute fees.',
      confidence: 'Confirmed',
      severity: online ? 'Medium' : 'Low',
      evidence: [
        factEvidence('Chargeback data', 'Not shown'),
        ruleEvidence('chargeback-visibility', 'Missing chargeback data is a visibility gap, not proof of no chargebacks')
      ],
      commercialImplication: online
        ? 'Dispute exposure cannot be assessed without gateway or acquirer dispute reporting.'
        : 'Chargebacks are not a primary focus from current data unless the merchant provides dispute reports.'
    };
  });

  return rules;
}

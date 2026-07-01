// api/_lib/pit/rules/stackRules.js
// Observation rules for stack visibility and missing components.

import { factEvidence, ruleEvidence } from '../engines/evidenceEngine.js';

export function stackObservationRules(ctx) {
  const { paymentsStack = {}, merchantProfile = {} } = ctx;
  const rules = [];

  rules.push(() => {
    if (!paymentsStack.missingComponents?.length) return null;
    return {
      id: 'OBS-STACK-001',
      category: 'Payments stack',
      title: 'Payments stack visibility is incomplete',
      observation: `Missing or unverified components include: ${paymentsStack.missingComponents.join(', ')}.`,
      confidence: 'Confirmed',
      severity: paymentsStack.missingComponents.length >= 3 ? 'High' : 'Medium',
      evidence: [
        factEvidence('Missing components', paymentsStack.missingComponents.join(', ')),
        ruleEvidence('stack-completeness', 'Stack completeness assessed from visible components and merchant context')
      ],
      commercialImplication: 'The PIT can assess visible acquiring costs, but total cost and operational performance may require additional data.'
    };
  });

  rules.push(() => {
    if (!paymentsStack.gateway && /online|card-not-present|cnp|omnichannel/i.test([merchantProfile.businessModel, merchantProfile.channelProfile].join(' '))) {
      return {
        id: 'OBS-STACK-002',
        category: 'Payments stack',
        title: 'Gateway costs may sit outside the statement',
        observation: 'Online acceptance appears relevant, but gateway costs are not visible.',
        confidence: 'Likely',
        severity: 'Medium',
        evidence: [
          factEvidence('Channel profile', merchantProfile.channelProfile || merchantProfile.businessModel),
          ruleEvidence('online-gateway-visibility', 'Online acceptance usually requires gateway visibility for full cost assessment')
        ],
        commercialImplication: 'The effective rate may not represent the merchant’s full cost of acceptance.'
      };
    }
    return null;
  });

  return rules;
}

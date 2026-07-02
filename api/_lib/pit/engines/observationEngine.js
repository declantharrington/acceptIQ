// api/_lib/pit/engines/observationEngine.js
// Commercial Observations Engine
// Runs deterministic observation rules and produces reusable, evidence-backed observations.

import { pricingObservationRules } from '../rules/pricingRules.js';
import { routingObservationRules } from '../rules/routingRules.js';
import { reformObservationRules } from '../rules/reformRules.js';
import { stackObservationRules } from '../rules/stackRules.js';
import { chargebackObservationRules } from '../rules/chargebackRules.js';
import { contractObservationRules } from '../rules/contractRules.js';
import { authenticationObservationRules } from '../rules/authenticationRules.js';
import { internationalObservationRules } from '../rules/internationalRules.js';
import { amexObservationRules } from '../rules/amexRules.js';
import { disputeObservationRules } from '../rules/disputeRules.js';
import { transactionObservationRules } from '../rules/transactionRules.js';
import { digitalPaymentObservationRules } from '../rules/digitalPaymentRules.js';
import { schemeFeeObservationRules } from '../rules/schemeFeeRules.js';
import { acquirerTypeObservationRules } from '../rules/acquirerTypeRules.js';
import { terminalObservationRules } from '../rules/terminalRules.js';
import { acceptanceObservationRules } from '../rules/acceptanceRules.js';
import { bnplObservationRules } from '../rules/bnplRules.js';
import { recurringBillingObservationRules } from '../rules/recurringBillingRules.js';
import { dccObservationRules } from '../rules/dccRules.js';

export function buildCommercialObservations(ctx) {
  const ruleFactories = [
    pricingObservationRules,
    routingObservationRules,
    reformObservationRules,
    stackObservationRules,
    chargebackObservationRules,
    contractObservationRules,
    authenticationObservationRules,
    internationalObservationRules,
    amexObservationRules,
    disputeObservationRules,
    transactionObservationRules,
    digitalPaymentObservationRules,
    schemeFeeObservationRules,
    acquirerTypeObservationRules,
    terminalObservationRules,
    acceptanceObservationRules,
    bnplObservationRules,
    recurringBillingObservationRules,
    dccObservationRules
  ];

  const observations = [];
  for (const factory of ruleFactories) {
    const rules = factory(ctx);
    for (const rule of rules) {
      const result = safeRunRule(rule);
      if (result) observations.push(normaliseObservation(result));
    }
  }

  return dedupeObservations(observations);
}

function safeRunRule(rule) {
  try {
    return rule();
  } catch (err) {
    console.warn('PIT observation rule failed:', err?.message || err);
    return null;
  }
}

function normaliseObservation(obs) {
  return {
    id: obs.id,
    category: obs.category || 'General',
    title: obs.title,
    observation: obs.observation || '',
    confidence: obs.confidence || 'Needs validation',
    severity: obs.severity || 'Low',
    evidence: obs.evidence || [],
    commercialImplication: obs.commercialImplication || ''
  };
}

function dedupeObservations(observations) {
  const seen = new Set();
  return observations.filter(o => {
    if (!o?.id || seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

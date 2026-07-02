// api/_lib/pit/rules/authenticationRules.js
// Observation rules for 3D Secure authentication fees, rates, and digital payment costs.
//
// These fees appear in the "Value Added Services & Network Fees" section of
// IC++ statements. They are per-transaction costs that compound significantly
// for online/CNP merchants and may be negotiable or avoidable through
// provider or authentication method changes.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const AUTH_3DS_LABELS = /3.?d.?secure|3ds|authentication fee|challenge fee/i;
const TOKENISATION_LABELS = /network token|digital wallet token|token fee|wallet token/i;
const ACCOUNT_UPDATER_LABELS = /account updater|card updater/i;

function find3DSFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => AUTH_3DS_LABELS.test(f.label || ''));
}

function findTokenisationFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => TOKENISATION_LABELS.test(f.label || ''));
}

function findAccountUpdaterFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => ACCOUNT_UPDATER_LABELS.test(f.label || ''));
}

function extract3DSMetrics(observations) {
  const obs = (observations || []).join(' ');
  const authRate    = obs.match(/(?:3ds|authentication)\s*(?:rate)?:?\s*([\d.]+)%/i)?.[1];
  const challengeRate = obs.match(/challenge\s*(?:rate)?:?\s*([\d.]+)%/i)?.[1];
  return {
    authRate:       authRate       ? Number(authRate)       : null,
    challengeRate:  challengeRate  ? Number(challengeRate)  : null,
  };
}

export function authenticationObservationRules(ctx) {
  const { facts = {}, metrics = {}, merchantProfile = {} } = ctx;
  const rules = [];

  // ── Rule 1: 3DS fees present ─────────────────────────────────────────────
  rules.push(() => {
    const fees3DS = find3DSFees(facts.feeBreakdown);
    if (!fees3DS.length) return null;

    const total3DS = fees3DS.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const { authRate, challengeRate } = extract3DSMetrics(facts.observations);

    // Assess whether challenge rate indicates a configuration opportunity
    let severity = 'Medium';
    let implication = '3DS authentication costs should be assessed against the merchant\'s fraud exposure and decline rate.';
    let observation = `3DS fees total $${total3DS.toFixed(2)}.`;

    if (challengeRate !== null) {
      observation += ` Authentication rate: ${authRate ?? 'not stated'}%. Challenge rate: ${challengeRate}% of authenticated CNP transactions.`;
      if (challengeRate > 15) {
        severity = 'High';
        implication = `A challenge rate of ${challengeRate}% is elevated. High challenge rates increase friction, may reduce conversion, and add per-challenge fees. Review 3DS configuration and exemption strategy.`;
      } else if (challengeRate <= 8) {
        severity = 'Low';
        implication = 'Challenge rate appears well-managed. Focus on per-authentication unit cost relative to fraud exposure.';
      }
    }

    return {
      id: 'OBS-AUTH-001',
      category: '3D Secure & Authentication',
      title: `3DS authentication fees are a visible cost line ($${total3DS.toFixed(2)})`,
      observation,
      confidence: 'Confirmed',
      severity,
      evidence: [
        ...fees3DS.map(f => factEvidence(f.label, `$${f.amount}`)),
        challengeRate !== null ? factEvidence('3DS challenge rate', `${challengeRate}%`) : null,
        ruleEvidence('3ds-fee-assessment', '3DS fee and challenge rate assessed against PIT bands')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: 3DS fees present but auth rate is low (potential fraud gap) ──
  rules.push(() => {
    const fees3DS = find3DSFees(facts.feeBreakdown);
    if (!fees3DS.length) return null;
    const { authRate } = extract3DSMetrics(facts.observations);
    if (authRate === null || authRate >= 90) return null;

    return {
      id: 'OBS-AUTH-002',
      category: '3D Secure & Authentication',
      title: `3DS authentication rate of ${authRate}% warrants review`,
      observation: `3DS authentication is active, but the authentication rate of ${authRate}% is below the 90% threshold that typically indicates a healthy implementation.`,
      confidence: 'Confirmed',
      severity: authRate < 75 ? 'High' : 'Medium',
      evidence: [
        factEvidence('3DS authentication rate', `${authRate}%`),
        kbEvidence('Authentication rates below 90% may indicate configuration gaps, card issuer friction, or eligibility mismatches')
      ],
      commercialImplication: 'Low authentication rates can increase fraud exposure and shift liability. A 3DS configuration review is warranted.'
    };
  });

  // ── Rule 3: Network tokenisation fees present ─────────────────────────────
  rules.push(() => {
    const tokenFees = findTokenisationFees(facts.feeBreakdown);
    if (!tokenFees.length) return null;
    const totalToken = tokenFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    return {
      id: 'OBS-AUTH-003',
      category: '3D Secure & Authentication',
      title: `Network tokenisation and digital wallet fees are visible ($${totalToken.toFixed(2)})`,
      observation: `Tokenisation-related fees total $${totalToken.toFixed(2)}.`,
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        ...tokenFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        ruleEvidence('tokenisation-fee-visibility', 'Tokenisation fees noted for stack completeness')
      ],
      commercialImplication: 'Tokenisation fees are generally accepted as a cost of maintaining credential currency and reducing declines. Verify unit rates are consistent with provider schedule.'
    };
  });

  return rules;
}

// api/_lib/pit/rules/disputeRules.js
// Observation rules for chargeback economics, dispute costs, and scheme
// monitoring threshold proximity.
//
// Goes beyond the existing chargebackRules.js (which only assesses data
// visibility) to analyse the financial impact of dispute activity, the
// cost breakdown (chargeback fees, representment fees, retrieval fees),
// and proximity to Visa/Mastercard scheme monitoring thresholds.

import { factEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

// Visa and Mastercard standard monitoring programme thresholds (Australia)
const VISA_THRESHOLD_STANDARD    = 0.65; // % of transactions
const MC_THRESHOLD_STANDARD      = 0.65; // % of transactions
const VISA_THRESHOLD_EXCESSIVE   = 1.80;
const MC_THRESHOLD_EXCESSIVE     = 1.50;

// Fees commonly found in the "Other Fees" section
const DISPUTE_FEE_LABELS = /chargeback\s*fee|dispute\s*fee|retrieval|representment/i;

function findDisputeFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => DISPUTE_FEE_LABELS.test(f.label || ''));
}

export function disputeObservationRules(ctx) {
  const { facts = {} } = ctx;
  const rules = [];

  // ── Rule 1: Chargeback economics — total dispute cost as a standalone line ─
  rules.push(() => {
    const cb = facts.chargebacks;
    const disputeFees = findDisputeFees(facts.feeBreakdown);
    const disputeFeeTotal = disputeFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    // Also check if chargeback fees are embedded in facts.chargebacks.fees
    const cbFees = cb?.fees || 0;
    const totalDisputeCost = Math.max(disputeFeeTotal, cbFees);

    if (!cb || (totalDisputeCost <= 0 && !cb.count)) return null;

    const count = cb.count || 0;
    const ratio = cb.ratio || 0;
    const annualisedDisputeCost = totalDisputeCost * 12;

    let severity = 'Low';
    let implication = 'Dispute costs are modest and within normal operating range.';

    if (ratio >= VISA_THRESHOLD_EXCESSIVE || ratio >= MC_THRESHOLD_EXCESSIVE) {
      severity = 'High';
      implication = 'Chargeback ratio is at or above scheme excessive thresholds. Immediate dispute management intervention is required to avoid enhanced monitoring, fines, or programme exit.';
    } else if (ratio >= VISA_THRESHOLD_STANDARD) {
      severity = 'High';
      implication = `Chargeback ratio of ${ratio}% is approaching or above scheme standard monitoring thresholds (Visa: ${VISA_THRESHOLD_STANDARD}%, Mastercard: ${MC_THRESHOLD_STANDARD}%). Active dispute management is required.`;
    } else if (totalDisputeCost > 1000) {
      severity = 'Medium';
      implication = `Total dispute cost of $${totalDisputeCost.toFixed(2)} per month ($${Math.round(annualisedDisputeCost).toLocaleString('en-AU')}/yr annualised) is material and warrants ongoing monitoring.`;
    }

    return {
      id: 'OBS-DISPUTE-001',
      category: 'Chargebacks & disputes',
      title: `Dispute activity: ${count} chargebacks, ratio ${ratio}%${totalDisputeCost > 0 ? `, total cost $${totalDisputeCost.toFixed(2)}` : ''}`,
      observation: [
        `${count} chargebacks recorded this period, ratio ${ratio}%.`,
        totalDisputeCost > 0 ? `Total dispute-related fees: $${totalDisputeCost.toFixed(2)} (annualised: $${Math.round(annualisedDisputeCost).toLocaleString('en-AU')}).` : '',
        disputeFees.length ? `Fee lines: ${disputeFees.map(f => `${f.label} $${f.amount}`).join(', ')}.` : ''
      ].filter(Boolean).join(' '),
      confidence: 'Confirmed',
      severity,
      evidence: [
        factEvidence('Chargeback count', count),
        factEvidence('Chargeback ratio', `${ratio}%`),
        totalDisputeCost > 0 ? factEvidence('Total dispute fees', `$${totalDisputeCost.toFixed(2)}`) : null,
        ...disputeFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        kbEvidence(`Visa standard monitoring threshold: ${VISA_THRESHOLD_STANDARD}% of transactions. Excessive: ${VISA_THRESHOLD_EXCESSIVE}%.`),
        kbEvidence(`Mastercard standard monitoring threshold: ${MC_THRESHOLD_STANDARD}%. Excessive: ${MC_THRESHOLD_EXCESSIVE}%.`),
        ruleEvidence('chargeback-economics', 'Dispute cost and ratio assessed against scheme monitoring thresholds')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: Representment analysis ───────────────────────────────────────
  rules.push(() => {
    const cb = facts.chargebacks;
    if (!cb?.count || cb.count < 5) return null;

    const representmentFees = (facts.feeBreakdown || []).filter(f =>
      /representment/i.test(f.label || '')
    );
    if (!representmentFees.length) return null;

    const reprTotal = representmentFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const reprCount = Math.round(reprTotal / 50); // Approximate from typical $50 fee
    const reprRate = cb.count > 0 ? Math.round(reprCount / cb.count * 100) : 0;

    return {
      id: 'OBS-DISPUTE-002',
      category: 'Chargebacks & disputes',
      title: `Chargeback representment activity visible — ${reprRate}% representment rate estimated`,
      observation: `Representment fees of $${reprTotal.toFixed(2)} suggest approximately ${reprCount} disputed chargebacks were contested this period (estimated ~${reprRate}% representment rate).`,
      confidence: 'Estimated',
      severity: reprRate < 30 ? 'Medium' : 'Low',
      evidence: [
        factEvidence('Representment fees', `$${reprTotal.toFixed(2)}`),
        factEvidence('Chargeback count', cb.count),
        ruleEvidence('representment-rate', 'Representment rate estimated from fee amounts')
      ],
      commercialImplication: reprRate < 30
        ? 'A low representment rate suggests some valid disputes may not be being contested. A dispute management review may recover avoidable losses.'
        : 'Representment activity is visible and active. Ensure win rates are being tracked to assess the value of the dispute management process.'
    };
  });

  return rules;
}

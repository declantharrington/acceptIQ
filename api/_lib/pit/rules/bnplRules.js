// api/_lib/pit/rules/bnplRules.js
// Observation rules for Buy Now Pay Later (BNPL) acceptance costs.
//
// BNPL providers (Afterpay, Zip, Klarna, Laybuy, Openpay, Humm) charge
// merchants a merchant discount rate (MDR) of 3–6%, which is typically
// 2–4x higher than card acceptance costs. This makes BNPL acceptance
// the highest per-transaction cost for most merchants who offer it.
//
// Post October 2026 surcharge removal: BNPL providers will also be
// unable to enforce no-surcharge rules, which may change the commercial
// calculation for merchants who currently absorb BNPL costs.
//
// BNPL fees typically appear as:
//   - A separate "BNPL fee" or "Afterpay fee" line item
//   - A separate statement from the BNPL provider (not the acquirer)
//   - In observations from the questionnaire

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const BNPL_LABELS = /afterpay|zip\s*pay|zippay|klarna|laybuy|openpay|humm|latitude\s*pay|payin[24]|buy.now.pay.later|bnpl/i;
const BNPL_FEE_LABELS = /afterpay.*fee|zip.*fee|bnpl.*fee|klarna.*fee|buy.now.pay.later.*fee/i;

// Typical BNPL MDR ranges (approximate)
const BNPL_RATES = {
  afterpay: { low: 4.0, high: 6.0, typical: 5.0 },
  zip:      { low: 2.5, high: 4.0, typical: 3.0 },
  klarna:   { low: 2.99, high: 5.99, typical: 3.99 },
  default:  { low: 3.0, high: 6.0, typical: 4.5 }
};

function detectBNPLProvider(facts) {
  const text = [
    (facts.observations || []).join(' '),
    (facts.feeBreakdown || []).map(f => f.label).join(' '),
    (facts.setup || []).map(s => `${s.label} ${s.value}`).join(' '),
    facts.context?.raw || ''
  ].join(' ').toLowerCase();

  if (/afterpay/.test(text)) return 'Afterpay';
  if (/zip\s*pay|zippay|zip\.co/.test(text)) return 'Zip';
  if (/klarna/.test(text)) return 'Klarna';
  if (/laybuy/.test(text)) return 'Laybuy';
  if (/openpay/.test(text)) return 'Openpay';
  if (/humm/.test(text)) return 'Humm';
  if (BNPL_LABELS.test(text)) return 'BNPL provider';
  return null;
}

function findBNPLFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f =>
    BNPL_LABELS.test(f.label || '') || BNPL_FEE_LABELS.test(f.label || '')
  );
}

export function bnplObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: BNPL acceptance is present ───────────────────────────────────
  rules.push(() => {
    const bnplProvider = detectBNPLProvider(facts);
    if (!bnplProvider) return null;

    const bnplFees = findBNPLFees(facts.feeBreakdown);
    const totalBNPLFee = bnplFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    const rateProfile = bnplProvider.toLowerCase() in BNPL_RATES
      ? BNPL_RATES[bnplProvider.toLowerCase()]
      : BNPL_RATES.default;

    const annualisedBNPLCost = totalBNPLFee > 0 ? totalBNPLFee * 12 : null;
    const effectiveRate = metrics.effectiveRate;

    // BNPL rate is typically 3–6x the card effective rate
    const comparison = effectiveRate
      ? `At a typical ${rateProfile.typical}% MDR, BNPL acceptance costs are approximately ${(rateProfile.typical / effectiveRate).toFixed(1)}× the merchant's current card acceptance rate.`
      : '';

    return {
      id: 'OBS-BNPL-001',
      category: 'BNPL',
      title: `${bnplProvider} acceptance present${totalBNPLFee > 0 ? ` — fees: $${totalBNPLFee.toFixed(2)}/month` : ''}`,
      observation: `${bnplProvider} acceptance is in use. BNPL merchant discount rates are typically ${rateProfile.low}–${rateProfile.high}% — significantly higher than standard card acceptance costs.${totalBNPLFee > 0 ? ` Visible BNPL fee on this statement: $${totalBNPLFee.toFixed(2)}/month ($${Math.round(annualisedBNPLCost).toLocaleString('en-AU')}/yr annualised).` : ' BNPL fees may be invoiced separately by the BNPL provider and not appear on this acquirer statement.'} ${comparison}`,
      confidence: bnplFees.length ? 'Confirmed' : 'Likely',
      severity: 'Medium',
      evidence: [
        factEvidence('BNPL provider', bnplProvider),
        bnplFees.length ? factEvidence('BNPL fees on statement', `$${totalBNPLFee.toFixed(2)}`) : null,
        effectiveRate ? metricEvidence('Card effective rate', `${effectiveRate}%`, 'Confirmed') : null,
        kbEvidence(`${bnplProvider} typically charges merchants ${rateProfile.low}–${rateProfile.high}% MDR. This is the highest per-transaction cost for most merchants who offer BNPL.`),
        ruleEvidence('bnpl-cost-assessment', 'BNPL acceptance cost assessed against card acceptance rate')
      ].filter(Boolean),
      commercialImplication: `BNPL acceptance is a strategic decision, not just a cost item. Assess whether the conversion uplift and basket size increase from BNPL justify the higher MDR. For merchants with existing high card volume, BNPL is rarely the most cost-effective payment option — but may be necessary for competitive reasons in certain retail categories.`
    };
  });

  // ── Rule 2: BNPL + October 2026 surcharge removal interaction ────────────
  rules.push(() => {
    const bnplProvider = detectBNPLProvider(facts);
    if (!bnplProvider) return null;

    const surchargeActive = (facts.context?.surcharge || '').toLowerCase().includes('yes') ||
      (facts.observations || []).some(o => /surcharge/i.test(o));

    return {
      id: 'OBS-BNPL-002',
      category: 'BNPL',
      title: `${bnplProvider} acceptance creates a specific October 2026 planning requirement`,
      observation: `From October 2026, BNPL providers will also be prohibited from enforcing no-surcharge rules on merchants. This changes the commercial calculus: merchants will theoretically be able to surcharge BNPL transactions, though consumer and competitive dynamics will determine whether this is practical.${surchargeActive ? ' This merchant currently applies a surcharge on card transactions, making the BNPL surcharge question especially relevant.' : ''}`,
      confidence: 'Confirmed',
      severity: 'Medium',
      evidence: [
        factEvidence('BNPL provider', bnplProvider),
        surchargeActive ? factEvidence('Current surcharge practice', 'Surcharge applied') : null,
        kbEvidence('October 2026 surcharge reforms prohibit BNPL providers from banning merchant surcharges, removing one of the historically unique commercial terms of BNPL agreements.'),
        ruleEvidence('bnpl-reform-interaction', 'BNPL flagged for October 2026 surcharge reform planning interaction')
      ].filter(Boolean),
      commercialImplication: 'The merchant should model the net impact of BNPL absorption post-surcharge removal: lower income from previously surcharged card transactions combined with continued BNPL MDR absorption. The October 2026 changes may make the total cost-to-serve calculation for BNPL more visible and more commercially challenging.'
    };
  });

  return rules;
}

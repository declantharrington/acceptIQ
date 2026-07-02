// api/_lib/pit/rules/dccRules.js
// Observation rules for Dynamic Currency Conversion (DCC).
//
// DCC allows merchants to offer foreign cardholders the option to pay in
// their home currency at the point of sale. The merchant and acquirer
// split a currency conversion margin (typically 2–4% above the base FX
// rate) on top of the standard card acceptance cost.
//
// DCC is a double-edged commercial consideration:
//   Revenue side: DCC margin can be a meaningful income stream for merchants
//                 with high international card volume (e.g. tourism, airports)
//   Cost side:    For merchants whose customers decline DCC, the fee lines
//                 may still appear as overhead with no corresponding revenue
//   Risk side:    Aggressive DCC presentation can trigger complaints,
//                 regulatory attention, and scheme rules violations
//
// DCC fees typically appear as:
//   - "Currency conversion fee" or "FX conversion fee"
//   - "DCC fee" or "DCC margin"
//   - Separate line from scheme/interchange fees

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const DCC_FEE_LABELS    = /currency conversion|fx conversion|dcc|dynamic currency|foreign currency conversion/i;
const DCC_OBSERVATION   = /dcc|dynamic currency|currency conversion|offered.*currency|foreign.*currency.*option/i;

function findDCCFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => DCC_FEE_LABELS.test(f.label || ''));
}

function isDCCMentioned(facts) {
  return (facts.observations || []).some(o => DCC_OBSERVATION.test(o)) ||
    (facts.setup || []).some(s => DCC_OBSERVATION.test(`${s.label} ${s.value}`));
}

export function dccObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: DCC fees visible on statement ─────────────────────────────────
  rules.push(() => {
    const dccFees = findDCCFees(facts.feeBreakdown);
    if (!dccFees.length && !isDCCMentioned(facts)) return null;

    const totalDCC = dccFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const foreignPct = facts.cardMix?.foreign ?? null;
    const foreignVolume = foreignPct && metrics.volume
      ? Math.round(metrics.volume * (Number(foreignPct) / 100))
      : null;

    const hasFees = totalDCC > 0;
    const annualised = hasFees ? totalDCC * 12 : null;

    return {
      id: 'OBS-DCC-001',
      category: 'Dynamic Currency Conversion',
      title: hasFees
        ? `DCC (Dynamic Currency Conversion) fees: $${totalDCC.toFixed(2)}/month`
        : 'DCC (Dynamic Currency Conversion) is indicated from questionnaire context',
      observation: [
        hasFees
          ? `DCC fee lines total $${totalDCC.toFixed(2)}/month ($${Math.round(annualised).toLocaleString('en-AU')}/yr annualised).`
          : 'DCC appears to be offered based on questionnaire or observation data.',
        foreignVolume
          ? `International card volume is ~$${foreignVolume.toLocaleString('en-AU')} this period.`
          : foreignPct ? `International card mix: ${foreignPct}%.` : '',
        'DCC allows the merchant to offer foreign cardholders payment in their home currency, with the merchant and acquirer sharing a conversion margin (typically 2–4% above base FX rate).'
      ].filter(Boolean).join(' '),
      confidence: hasFees ? 'Confirmed' : 'Likely',
      severity: 'Medium',
      evidence: [
        ...dccFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        foreignPct ? factEvidence('Foreign card mix', `${foreignPct}%`) : null,
        foreignVolume ? metricEvidence('International card volume', `$${foreignVolume.toLocaleString('en-AU')}`, 'Estimated') : null,
        kbEvidence('DCC margin is typically 2–4% above the base FX rate and is shared between the merchant and acquirer. The share varies by agreement.'),
        ruleEvidence('dcc-cost-assessment', 'DCC fees and international volume assessed for revenue and compliance context')
      ].filter(Boolean),
      commercialImplication: 'DCC is a revenue opportunity for merchants with high international card volume, but requires careful commercial assessment. Validate the DCC share agreement with the acquirer, the cardholder acceptance/decline rate, and compliance with Visa/Mastercard DCC scheme rules (particularly around presentment practices). Aggressive DCC presentment can result in scheme investigations.'
    };
  });

  // ── Rule 2: High international volume without visible DCC ─────────────────
  rules.push(() => {
    const foreignPct = facts.cardMix?.foreign;
    if (!foreignPct || Number(foreignPct) < 5) return null;

    const dccFees = findDCCFees(facts.feeBreakdown);
    if (dccFees.length || isDCCMentioned(facts)) return null; // Already handled by Rule 1

    const foreignVolume = metrics.volume
      ? Math.round(metrics.volume * (Number(foreignPct) / 100))
      : null;

    return {
      id: 'OBS-DCC-002',
      category: 'Dynamic Currency Conversion',
      title: `${Number(foreignPct)}% international card mix without visible DCC`,
      observation: `International cards represent ${Number(foreignPct)}% of visible card mix${foreignVolume ? ` (~$${foreignVolume.toLocaleString('en-AU')})` : ''}, but no DCC fees or DCC arrangement is evident. This may represent an unexplored revenue opportunity for the merchant.`,
      confidence: 'Likely',
      severity: 'Low',
      evidence: [
        factEvidence('Foreign card mix', `${Number(foreignPct)}%`),
        foreignVolume ? metricEvidence('Estimated international volume', `$${foreignVolume.toLocaleString('en-AU')}`, 'Estimated') : null,
        kbEvidence('Merchants with material international card volume (typically >5% of mix) may be eligible for DCC, which can generate a conversion margin revenue stream.'),
        ruleEvidence('dcc-opportunity', 'International card volume assessed for DCC opportunity')
      ].filter(Boolean),
      commercialImplication: 'With material international card volume, DCC may be worth exploring as a supplementary revenue stream. However, any DCC arrangement should be assessed for net benefit after share agreements, compliance requirements, and potential impact on customer experience.'
    };
  });

  return rules;
}

// api/_lib/pit/rules/internationalRules.js
// Observation rules for international card volume, foreign interchange premiums,
// cross-border assessment fees, and UnionPay acceptance.
//
// International cards attract significantly higher interchange rates (typically
// 1.8–2.5% vs 0.2–0.8% for domestic) and separate cross-border scheme fees.
// This affects effective rate meaningfully for merchants with tourism or
// cross-border e-commerce exposure.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const INTERNATIONAL_LABELS = /international|foreign|cross.border|overseas/i;
const UNIONPAY_LABELS = /unionpay|union pay|cup/i;

function findInternationalFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => INTERNATIONAL_LABELS.test(f.label || ''));
}

function findUnionPayFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => UNIONPAY_LABELS.test(f.label || ''));
}

function extractInternationalVolume(observations) {
  const obs = (observations || []).join(' ');
  const match = obs.match(/international\s+(?:sales|volume)[:\s]+\$?([\d,]+)/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

export function internationalObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Foreign card mix is commercially material ─────────────────────
  rules.push(() => {
    const foreignPct = metrics.cardMix?.foreignPct ?? facts.cardMix?.foreign;
    if (foreignPct == null || Number(foreignPct) <= 0) return null;

    const n = Number(foreignPct);
    const intlFees = findInternationalFees(facts.feeBreakdown);
    const intlFeeTotal = intlFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const intlVolume = extractInternationalVolume(facts.observations) ||
      (facts.volume && n > 0 ? facts.volume * (n / 100) : null);

    let severity = 'Low';
    let implication = 'International card volume is present but modest. Monitor cross-border fee line items on future statements.';

    if (n >= 10) {
      severity = 'High';
      implication = 'International card volume is significant and is likely driving the effective rate above domestic benchmarks. Cross-border scheme fees and premium interchange are material cost lines that warrant specific review.';
    } else if (n >= 3) {
      severity = 'Medium';
      implication = 'International card volume contributes to a higher blended effective rate. Assess whether acceptance strategy (currency, DCC, routing) is optimised for cross-border transactions.';
    }

    return {
      id: 'OBS-INTL-001',
      category: 'International cards',
      title: `International card volume represents ${n}% of card mix`,
      observation: `Foreign/international cards represent ${n}% of visible card volume${intlVolume ? ` (~$${Math.round(intlVolume).toLocaleString('en-AU')})` : ''}. International cards attract interchange rates typically 4–8× higher than domestic equivalents.${intlFeeTotal > 0 ? ` Visible cross-border scheme fees: $${intlFeeTotal.toFixed(2)}.` : ''}`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        metricEvidence('Foreign card mix', `${n}%`, 'Confirmed'),
        intlFees.length ? factEvidence('Cross-border scheme fees', `$${intlFeeTotal.toFixed(2)}`) : null,
        kbEvidence('International interchange rates are typically 1.8–2.5% vs 0.2–0.8% domestic', 'Cross-border transactions are excluded from Australian interchange reform caps'),
        ruleEvidence('international-card-materiality', 'International mix assessed against PIT materiality bands')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: International card volume is excluded from reform benefit ──────
  rules.push(() => {
    const foreignPct = metrics.cardMix?.foreignPct ?? facts.cardMix?.foreign;
    if (foreignPct == null || Number(foreignPct) < 3) return null;
    if (!metrics.reformSavings) return null;

    return {
      id: 'OBS-INTL-002',
      category: 'International cards',
      title: 'International card volume is excluded from October 2026 interchange reform',
      observation: `The October 2026 consumer credit interchange cap applies to domestic Australian-issued cards only. International cards (~${Number(foreignPct)}% of mix) will remain at current rates.`,
      confidence: 'Confirmed',
      severity: 'Medium',
      evidence: [
        factEvidence('Foreign card mix', `${Number(foreignPct)}%`),
        kbEvidence('RBA interchange reform caps apply to Australian-issued consumer cards only — international cards are not included'),
        ruleEvidence('reform-international-exclusion', 'International card volume noted as reform exclusion')
      ],
      commercialImplication: 'Reform savings estimates may overstate the benefit if international volume is not excluded from the calculation. The visible reform saving should be understood as applying to the domestic credit portion only.'
    };
  });

  // ── Rule 3: UnionPay volume present ───────────────────────────────────────
  rules.push(() => {
    const upFees = findUnionPayFees(facts.feeBreakdown);
    if (!upFees.length) {
      // Also check observations for UnionPay mention
      const hasUP = (facts.observations || []).some(o => UNIONPAY_LABELS.test(o));
      if (!hasUP) return null;
    }

    const upFeeTotal = upFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    // Find UnionPay MSF from observations if present
    const upRateMatch = (facts.observations || []).join(' ').match(/unionpay[^%]*?([\d.]+)%/i);
    const upRate = upRateMatch ? Number(upRateMatch[1]) : null;

    return {
      id: 'OBS-INTL-003',
      category: 'International cards',
      title: 'UnionPay acceptance is present',
      observation: `UnionPay transactions are visible on this statement.${upRate ? ` MSF rate: ${upRate}%.` : ''}${upFeeTotal > 0 ? ` Scheme fees: $${upFeeTotal.toFixed(2)}.` : ''} UnionPay is a closed-loop network with separate pricing, typically accepted at higher MSF rates.`,
      confidence: 'Confirmed',
      severity: upRate && upRate > 1.5 ? 'Medium' : 'Low',
      evidence: [
        upFees.length ? factEvidence('UnionPay scheme fees', `$${upFeeTotal.toFixed(2)}`) : null,
        upRate ? factEvidence('UnionPay MSF rate', `${upRate}%`) : null,
        kbEvidence('UnionPay operates as a closed-loop network; acceptance terms are separately negotiated with the acquirer'),
        ruleEvidence('unionpay-presence', 'UnionPay noted as a separate card network requiring individual assessment')
      ].filter(Boolean),
      commercialImplication: 'UnionPay acceptance should be reviewed as a standalone commercial decision. Rate, volume, and strategic value should be assessed separately from Visa/Mastercard.'
    };
  });

  return rules;
}

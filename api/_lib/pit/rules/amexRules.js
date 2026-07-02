// api/_lib/pit/rules/amexRules.js
// Observation rules for American Express acceptance costs.
//
// AMEX is a closed-loop network with a separate MSF negotiated directly
// with the acquirer (or AMEX itself for OptBlue merchants). It is not
// subject to Australian interchange regulation or the October 2026 reform.
// For high-ATV merchants, AMEX can represent a material and distinct
// commercial decision.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const AMEX_RATE_THRESHOLD_HIGH = 1.5;  // Above this: warrant review
const AMEX_RATE_THRESHOLD_MED  = 1.2;  // Above this: flag for awareness

export function amexObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: AMEX mix is commercially material ─────────────────────────────
  rules.push(() => {
    const amexPct = metrics.cardMix?.amexPct ?? facts.cardMix?.amex;
    if (amexPct == null || Number(amexPct) <= 0) return null;

    const n = Number(amexPct);
    const amexVolume = facts.volume && n > 0 ? Math.round(facts.volume * n / 100) : null;

    // Try to find AMEX MSF rate from observations or feeBreakdown
    const amexRateMatch = (facts.observations || []).join(' ').match(/amex[^%]*?([\d.]+)%/i)
      || (facts.observations || []).join(' ').match(/american\s+express[^%]*?([\d.]+)%/i);
    const amexRate = amexRateMatch ? Number(amexRateMatch[1]) : null;

    let severity = 'Low';
    let implication = 'AMEX acceptance should be reviewed periodically as a standalone commercial decision, separate from Visa/Mastercard.';
    let title = `AMEX represents ${n}% of card mix`;

    if (n >= 10) {
      severity = 'Medium';
      title = `AMEX is a material card type at ${n}% of card mix`;
      implication = 'AMEX volume is commercially significant. The MSF rate, negotiation leverage, and strategic value of AMEX acceptance should be reviewed independently.';
    }

    if (amexRate && amexRate >= AMEX_RATE_THRESHOLD_HIGH) {
      severity = 'High';
      title = `AMEX is a material card type at ${n}% mix with an elevated MSF rate`;
      implication = `AMEX MSF rate of ${amexRate}% is above typical negotiated rates for this volume tier. With ${amexVolume ? '$' + amexVolume.toLocaleString('en-AU') + ' in AMEX volume' : 'material AMEX volume'}, this rate warrants a commercial review.`;
    } else if (amexRate && amexRate >= AMEX_RATE_THRESHOLD_MED) {
      severity = 'Medium';
      implication = `AMEX MSF rate of ${amexRate}% is within a normal range for smaller volume tiers, but should be revisited as volume grows.`;
    }

    return {
      id: 'OBS-AMEX-001',
      category: 'American Express',
      title,
      observation: `American Express represents ${n}% of visible card mix${amexVolume ? ` (~$${amexVolume.toLocaleString('en-AU')})` : ''}.${amexRate ? ` MSF rate: ${amexRate}%.` : ' AMEX MSF rate not separately stated.'}`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        metricEvidence('AMEX card mix', `${n}%`, 'Confirmed'),
        amexVolume ? metricEvidence('Estimated AMEX volume', `$${amexVolume.toLocaleString('en-AU')}`, 'Estimated') : null,
        amexRate ? factEvidence('AMEX MSF rate', `${amexRate}%`) : null,
        kbEvidence('AMEX is a closed-loop network; rates are negotiated separately from Visa/Mastercard acquiring terms'),
        ruleEvidence('amex-mix-assessment', 'AMEX mix assessed for commercial materiality')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: AMEX excluded from October 2026 reform ───────────────────────
  rules.push(() => {
    const amexPct = metrics.cardMix?.amexPct ?? facts.cardMix?.amex;
    if (amexPct == null || Number(amexPct) < 5) return null;
    if (!metrics.reformSavings) return null;

    return {
      id: 'OBS-AMEX-002',
      category: 'American Express',
      title: 'AMEX volume is excluded from October 2026 interchange reform',
      observation: `AMEX represents ${Number(amexPct)}% of card mix. As a closed-loop network, AMEX interchange is not regulated by the RBA and is not subject to the October 2026 interchange cap.`,
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        factEvidence('AMEX card mix', `${Number(amexPct)}%`),
        kbEvidence('AMEX interchange is not regulated under Australian interchange standards and is excluded from the October 2026 reform caps'),
        ruleEvidence('amex-reform-exclusion', 'AMEX noted as outside RBA interchange regulation')
      ],
      commercialImplication: 'Reform savings do not apply to AMEX volume. The reform saving should be understood as applying to Visa/Mastercard consumer credit cards only.'
    };
  });

  return rules;
}

// api/_lib/pit/rules/schemeFeeRules.js
// Observation rules for scheme fee line items, composition, and growth.
//
// Scheme fees are what Visa, Mastercard and eftpos charge for using their
// networks. They are separate from interchange and have been rising faster
// than interchange for several years. The RBA's October 2026 transparency
// reforms require acquirers to separately disclose scheme fees on statements,
// making them increasingly visible and assessable.
//
// Key fee types to detect:
//   Visa: MFIS (Merchant Fee for International Service), Contactless surcharge,
//         Fixed Acquirer Network Fee (FANF), Acquirer Processing Fee (APF)
//   Mastercard: Digital Enablement Fee, Processing Integrity Fee,
//               Cross-Border Assessment
//   eftpos: Scheme Administration Fee, CPOS fee
//   Generic: Network access, Scheme service fee, Assessment fee

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

// Known scheme fee label patterns
const SCHEME_FEE_LABELS = /scheme fee|network fee|assessment fee|visa fee|mastercard fee|network access|mc fee|scheme service/i;
const VISA_SPECIFIC     = /visa.*(?:mfis|mfie|fanf|apf|contactless|international|assessment)|mfis|fanf/i;
const MC_SPECIFIC       = /mastercard.*(?:digital|integrity|enablement|processing|cross.border|assessment)|digital enablement|processing integrity/i;
const EFTPOS_SPECIFIC   = /eftpos.*(?:scheme|admin|cpos|network)|eftpos fee/i;

function findSchemeFeeLines(feeBreakdown) {
  return (feeBreakdown || []).filter(f =>
    SCHEME_FEE_LABELS.test(f.label || '') ||
    VISA_SPECIFIC.test(f.label || '') ||
    MC_SPECIFIC.test(f.label || '') ||
    EFTPOS_SPECIFIC.test(f.label || '')
  );
}

function categoriseSchemeLines(lines) {
  const visa = lines.filter(f => /visa/i.test(f.label || '') || VISA_SPECIFIC.test(f.label || ''));
  const mc   = lines.filter(f => /mastercard|mc\b/i.test(f.label || '') || MC_SPECIFIC.test(f.label || ''));
  const eftp = lines.filter(f => EFTPOS_SPECIFIC.test(f.label || ''));
  const other = lines.filter(f => !visa.includes(f) && !mc.includes(f) && !eftp.includes(f));
  return { visa, mc, eftp, other };
}

export function schemeFeeObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Scheme fees are itemised (IC++ transparency) ─────────────────
  rules.push(() => {
    const schemeLines = findSchemeFeeLines(facts.feeBreakdown);
    if (!schemeLines.length) return null;

    const total = schemeLines.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const { visa, mc, eftp, other } = categoriseSchemeLines(schemeLines);
    const totalFees = metrics.totalFees || 1;
    const schemePct = total > 0 ? (total / totalFees * 100).toFixed(1) : null;

    const parts = [];
    if (visa.length)  parts.push(`Visa: $${visa.reduce((s,f)=>s+(Number(f.amount)||0),0).toFixed(2)}`);
    if (mc.length)    parts.push(`Mastercard: $${mc.reduce((s,f)=>s+(Number(f.amount)||0),0).toFixed(2)}`);
    if (eftp.length)  parts.push(`eftpos: $${eftp.reduce((s,f)=>s+(Number(f.amount)||0),0).toFixed(2)}`);
    if (other.length) parts.push(`Other: $${other.reduce((s,f)=>s+(Number(f.amount)||0),0).toFixed(2)}`);

    // Elevated scheme fees: above 10% of total fees is worth flagging
    const elevated = schemePct && Number(schemePct) > 10;

    return {
      id: 'OBS-SCHEME-001',
      category: 'Scheme fees',
      title: `Scheme fees are itemised and total $${total.toFixed(2)}${schemePct ? ` (${schemePct}% of total fees)` : ''}`,
      observation: `Scheme fee line items are separately visible. ${parts.join('. ')}.${elevated ? ` At ${schemePct}% of total fees, scheme fees are above the typical range and warrant specific review.` : ''}`,
      confidence: 'Confirmed',
      severity: elevated ? 'Medium' : 'Low',
      evidence: [
        ...schemeLines.map(f => factEvidence(f.label, `$${f.amount}`)),
        schemePct ? metricEvidence('Scheme fees as % of total fees', `${schemePct}%`, 'Confirmed') : null,
        kbEvidence('Scheme fees have been growing faster than interchange and are increasingly visible on IC++ statements'),
        ruleEvidence('scheme-fee-itemisation', 'Scheme fee lines identified and categorised by network')
      ].filter(Boolean),
      commercialImplication: elevated
        ? 'Scheme fees at this level represent a meaningful and growing cost component. While not directly negotiable with the acquirer, they are assessable for accuracy and may signal an older or non-standard network agreement.'
        : 'Scheme fee visibility is a positive indicator of pricing transparency. Monitor for growth across periods.'
    };
  });

  // ── Rule 2: Specific named scheme fees that may warrant review ────────────
  rules.push(() => {
    const schemeLines = findSchemeFeeLines(facts.feeBreakdown);
    if (!schemeLines.length) return null;

    const notable = [];

    // MFIS / international scheme fees on domestic-only merchants
    const mfisLine = schemeLines.find(f => /mfis|merchant fee.*international|international.*assessment/i.test(f.label || ''));
    if (mfisLine) {
      const foreignPct = facts.cardMix?.foreign ?? 0;
      if (Number(foreignPct) < 5) {
        notable.push({
          label: mfisLine.label,
          amount: mfisLine.amount,
          note: 'MFIS is typically charged on international card transactions. Low international card mix suggests this fee warrants verification.'
        });
      }
    }

    // Digital Enablement Fee - often not well understood by merchants
    const defLine = schemeLines.find(f => /digital enablement|digital.*enablement/i.test(f.label || ''));
    if (defLine) {
      notable.push({
        label: defLine.label,
        amount: defLine.amount,
        note: 'Mastercard Digital Enablement Fee applies to tokenised digital wallet transactions. Growth in Apple Pay / Google Pay acceptance drives this fee.'
      });
    }

    if (!notable.length) return null;

    return {
      id: 'OBS-SCHEME-002',
      category: 'Scheme fees',
      title: `${notable.length} scheme fee line item${notable.length > 1 ? 's' : ''} warrant${notable.length === 1 ? 's' : ''} specific review`,
      observation: notable.map(n => `${n.label} ($${n.amount}): ${n.note}`).join(' '),
      confidence: 'Likely',
      severity: 'Medium',
      evidence: [
        ...notable.map(n => factEvidence(n.label, `$${n.amount}`)),
        ruleEvidence('scheme-fee-review', 'Named scheme fees assessed for accuracy and relevance')
      ],
      commercialImplication: 'These scheme fee line items should be verified against the acquirer pricing schedule to confirm they are being applied correctly and at the right rates.'
    };
  });

  // ── Rule 3: Scheme fees not visible (opaque pricing context) ─────────────
  rules.push(() => {
    const schemeLines = findSchemeFeeLines(facts.feeBreakdown);
    if (schemeLines.length) return null; // Already covered by Rule 1

    // Only relevant for blended or unknown pricing where scheme fees would be bundled
    const model = (facts.pricingModel || '').toLowerCase();
    const isBlended = /blended|single.rate|flat/.test(model) || model === 'unknown' || !model;
    if (!isBlended) return null;

    return {
      id: 'OBS-SCHEME-003',
      category: 'Scheme fees',
      title: 'Scheme fees are not separately visible on this statement',
      observation: 'No scheme fee line items are identifiable. On a blended or single-rate plan, scheme fees are absorbed into the MSF and not disclosed separately.',
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        factEvidence('Pricing model', facts.pricingModel || 'Not stated'),
        factEvidence('Scheme fee lines', 'Not visible'),
        kbEvidence('From October 2026, acquirers must separately disclose scheme fees on merchant statements under RBA transparency reforms'),
        ruleEvidence('scheme-fee-opacity', 'Scheme fee visibility assessed against pricing model')
      ],
      commercialImplication: 'From October 2026, transparency reforms require scheme fees to be separately disclosed. The merchant will gain visibility of this cost component for the first time, enabling more accurate cost benchmarking.'
    };
  });

  return rules;
}

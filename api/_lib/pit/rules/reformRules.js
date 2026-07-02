// api/_lib/pit/rules/reformRules.js
// Observation rules for Australian payments reforms and regulatory change.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

export function reformObservationRules(ctx) {
  const { facts = {}, metrics = {}, industryIntelligence = {} } = ctx;
  const rules = [];

  rules.push(() => {
    const creditPct = metrics.cardMix?.creditPct ?? facts.cardMix?.credit;
    if (!creditPct || Number(creditPct) <= 0) return null;
    return {
      id: 'OBS-REFORM-001',
      category: 'Industry reform',
      title: 'October 2026 credit interchange reform is relevant',
      observation: `Credit represents ${creditPct}% of visible card volume.`,
      confidence: metrics.reformSavings ? 'Estimated' : 'Needs validation',
      severity: metrics.reformSavings?.annual >= 10000 ? 'High' : 'Medium',
      evidence: [
        metricEvidence('Credit mix', `${creditPct}%`, 'Confirmed'),
        metrics.reformSavings ? metricEvidence('Estimated reform saving', `$${metrics.reformSavings.annual}/yr`, metrics.reformSavings.confidence || 'Estimated') : null,
        kbEvidence('Consumer credit interchange cap falls to 0.30% from 1 October 2026')
      ].filter(Boolean),
      commercialImplication: 'Provider pass-through and consumer/commercial card split should be validated before the reform date.'
    };
  });

  rules.push(() => {
    const text = [
      facts.context?.surcharge,
      facts.context?.raw,
      facts.observations?.join(' ')
    ].join(' ');
    if (!/surcharge|surcharging/i.test(text)) return null;

    // Estimate the P&L impact of absorbing surcharge costs
    const surchargePct = 0.012; // ~1.2% typical surcharge rate
    const estimatedMonthlySurchargeRevenue = metrics.volume
      ? Math.round(metrics.volume * surchargePct)
      : null;

    return {
      id: 'OBS-REFORM-002',
      category: 'Industry reform',
      title: 'Surcharge removal requires an active absorption and repricing strategy',
      observation: `Surcharging appears relevant from the questionnaire or statement observations. From October 2026, surcharging on Visa, Mastercard and eftpos transactions (debit, prepaid and credit) will be prohibited.${estimatedMonthlySurchargeRevenue ? ` If the merchant is recovering card costs via surcharge, removing it at the current effective rate of ${metrics.effectiveRate}% could represent approximately $${estimatedMonthlySurchargeRevenue.toLocaleString('en-AU')}/month in absorbed costs unless pricing is adjusted.` : ''}`,
      confidence: 'Needs validation',
      severity: 'High',
      evidence: [
        factEvidence('Surcharge relevance', 'Detected'),
        metrics.volume ? metricEvidence('Estimated monthly surcharge absorption', estimatedMonthlySurchargeRevenue ? `$${estimatedMonthlySurchargeRevenue.toLocaleString('en-AU')}` : 'Not calculable', 'Estimated') : null,
        kbEvidence('Card surcharging on Visa, Mastercard and eftpos removed from 1 October 2026. Merchants must either absorb card costs, adjust product/service pricing, or reduce their cost of acceptance before this date.'),
        ruleEvidence('surcharge-reform-strategy', 'Surcharge removal assessed for P&L and strategic response requirements')
      ].filter(Boolean),
      commercialImplication: 'The merchant needs an explicit strategy before October 2026: (1) absorb costs within existing margins, (2) reprice products/services to recover the cost, (3) reduce cost of acceptance through better pricing, LCR or provider change, or (4) a combination. This is one of the most commercially significant planning items for any surcharging merchant in 2026.'
    };
  });

  // ── NEW: April 2027 foreign card interchange reform ───────────────────────
  rules.push(() => {
    const foreignPct = metrics.cardMix?.foreignPct ?? facts.cardMix?.foreign;
    if (!foreignPct || Number(foreignPct) < 2) return null;

    const foreignVolume = metrics.volume
      ? Math.round(metrics.volume * (Number(foreignPct) / 100))
      : null;

    // Estimate benefit: foreign card interchange typically ~2.0–2.2%
    // New foreign cap from April 2027 is 0.80% (same as current domestic cap)
    const estimatedDelta = 0.012; // ~1.2% average reduction (2.0% → 0.80%)
    const estimatedMonthlyBenefit = foreignVolume
      ? Math.round(foreignVolume * estimatedDelta)
      : null;

    return {
      id: 'OBS-REFORM-003',
      category: 'Industry reform',
      title: `April 2027 foreign card interchange reform is also relevant (${Number(foreignPct)}% international mix)`,
      observation: `A separate foreign card interchange cap comes into effect on 1 April 2027, applying the same cap structure to international/foreign-issued cards that the October 2026 reform applies to domestic cards. Foreign cards currently attract interchange of ~2.0–2.2% (vs 0.20–0.80% for domestic).${foreignVolume ? ` International volume this period: ~$${foreignVolume.toLocaleString('en-AU')}.` : ''}${estimatedMonthlyBenefit ? ` Estimated monthly saving from April 2027 reform: ~$${estimatedMonthlyBenefit.toLocaleString('en-AU')} (directional estimate only).` : ''}`,
      confidence: 'Estimated',
      severity: Number(foreignPct) >= 10 ? 'High' : 'Medium',
      evidence: [
        metricEvidence('Foreign card mix', `${Number(foreignPct)}%`, 'Confirmed'),
        foreignVolume ? metricEvidence('International card volume', `$${foreignVolume.toLocaleString('en-AU')}`, 'Estimated') : null,
        estimatedMonthlyBenefit ? metricEvidence('Estimated April 2027 reform saving', `~$${estimatedMonthlyBenefit.toLocaleString('en-AU')}/month`, 'Estimated') : null,
        kbEvidence('Foreign card interchange caps align with domestic caps from 1 April 2027 (RBA March 2026 Conclusions Paper). This is a separate and additional benefit from the October 2026 domestic reform.'),
        ruleEvidence('foreign-card-reform-2027', 'April 2027 foreign card interchange reform assessed for merchant relevance')
      ].filter(Boolean),
      commercialImplication: 'The April 2027 foreign card reform provides a second wave of interchange benefit for merchants with material international card volume. Unlike the October 2026 domestic reform, this benefit has not been widely communicated and may be overlooked in merchant planning. Pass-through contractual terms should be validated for foreign card transactions separately from domestic cards.'
    };
  });

  return rules;
}


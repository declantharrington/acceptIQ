// api/_lib/pit/calculateMetrics.js
// Deterministic calculations owned by the Payments Intelligence Engine.

export function calculatePITMetrics(facts) {
  const avgFeePerTxn = calculateAvgFeePerTxn(facts);
  const feeComposition = calculateFeeComposition(facts);
  derivePricingModelFromFeeComposition(facts, feeComposition);
  const benchmarkBars = calculateBenchmarkBars(facts);
  const reformSavings = calculateReformSavings(facts);
  const lcrSavings = calculateLcrSavings(facts);
  const snapshot = calculateSnapshot(facts, { reformSavings, lcrSavings });

  return { avgFeePerTxn, feeComposition, benchmarkBars, reformSavings, lcrSavings, snapshot };
}

export function calculateAvgFeePerTxn(report) {
  if (report.volume && report.transactions && report.effectiveRate) {
    return (Number(report.volume) / Number(report.transactions)) * (Number(report.effectiveRate) / 100);
  }
  if (report.perTransactionFee != null) return Number(report.perTransactionFee) / 100;
  return null;
}

export function calculateFeeComposition(report) {
  const items = Array.isArray(report.feeBreakdown) ? report.feeBreakdown : [];
  if (!items.length) return null;
  let interchange = 0, scheme = 0, margin = 0, other = 0;
  for (const item of items) {
    const label = (item.label || '').toLowerCase();
    const amt = Number(item.amount) || 0;
    if (/interchange/.test(label)) interchange += amt;
    else if (/scheme/.test(label)) scheme += amt;
    else if (/margin|merchant service fee|msf|provider/.test(label)) margin += amt;
    else other += amt;
  }
  const totalBeforeFold = interchange + scheme + margin + other;
  if (totalBeforeFold <= 0) return null;
  margin += other;
  const total = interchange + scheme + margin;
  return {
    interchangePct: Math.round((interchange / total) * 1000) / 10,
    schemePct: Math.round((scheme / total) * 1000) / 10,
    marginPct: Math.round((margin / total) * 1000) / 10,
    interchangeAmt: interchange,
    schemeAmt: scheme,
    marginAmt: margin,
  };
}

export function derivePricingModelFromFeeComposition(report, feeComposition) {
  if (!feeComposition) return report.pricingModel || null;
  const hasInterchange = feeComposition.interchangeAmt > 0;
  const hasScheme = feeComposition.schemeAmt > 0;
  const hasMargin = feeComposition.marginAmt > 0;
  let derived = null;
  if (hasInterchange && hasScheme && hasMargin) derived = 'Interchange-plus-plus';
  else if (hasInterchange && hasMargin && !hasScheme) derived = 'Interchange-plus';
  if (derived && report.pricingModel && derived !== report.pricingModel) {
    console.warn(`PIT: pricingModel mismatch - extracted "${report.pricingModel}", fee breakdown structurally shows "${derived}". Using derived value.`);
    report.pricingModel = derived;
  } else if (derived && !report.pricingModel) {
    report.pricingModel = derived;
  }
  return report.pricingModel || derived;
}

export function calculateBenchmarkBars(report) {
  if (report.effectiveRate == null) return null;
  const you = Number(report.effectiveRate);
  const refs = { smallBlended: 1.4, smallUnblended: 0.9, large: 0.6 };
  const ceiling = Math.max(you, refs.smallBlended) * 1.15;
  const pct = v => Math.max(2, Math.round((v / ceiling) * 1000) / 10);
  return {
    you: { value: you, pct: pct(you) },
    smallBlended: { value: refs.smallBlended, pct: pct(refs.smallBlended) },
    smallUnblended: { value: refs.smallUnblended, pct: pct(refs.smallUnblended) },
    large: { value: refs.large, pct: pct(refs.large) },
  };
}

export function calculateReformSavings(report) {
  const creditPct = report.cardMix && report.cardMix.credit != null ? Number(report.cardMix.credit) : null;
  if (!report.volume || creditPct == null || Number.isNaN(creditPct) || creditPct <= 0) return null;
  const creditTurnover = Number(report.volume) * (creditPct / 100);
  const CURRENT_AVG_RATE = 0.47;
  const NEW_CAP_RATE = 0.30;
  const monthly = creditTurnover * ((CURRENT_AVG_RATE - NEW_CAP_RATE) / 100);
  if (monthly <= 0) return null;
  return { creditTurnover, monthly, annual: monthly * 12 };
}

export function calculateLcrSavings(report) {
  const debitPct = report.cardMix && report.cardMix.debit != null ? Number(report.cardMix.debit) : null;
  if (!report.volume || !report.effectiveRate || debitPct == null || Number.isNaN(debitPct) || debitPct <= 0) return null;
  const debitTurnover = Number(report.volume) * (debitPct / 100);
  const estDebitFees = debitTurnover * (Number(report.effectiveRate) / 100);
  const LCR_REDUCTION = 0.20;
  const monthly = estDebitFees * LCR_REDUCTION;
  if (monthly <= 0) return null;
  return { debitTurnover, estDebitFees, monthly, annual: monthly * 12 };
}

export function calculateSnapshot(report, { reformSavings, lcrSavings }) {
  const debitPct = report.cardMix && report.cardMix.debit != null ? Number(report.cardMix.debit) : null;
  const creditPct = report.cardMix && report.cardMix.credit != null ? Number(report.cardMix.credit) : null;
  const debitVolume = report.volume && debitPct != null && !Number.isNaN(debitPct) ? Number(report.volume) * (debitPct / 100) : null;
  const creditVolume = report.volume && creditPct != null && !Number.isNaN(creditPct) ? Number(report.volume) * (creditPct / 100) : null;
  const lcrIsConfirmedOn = ['on', 'enabled', 'active', 'yes'].includes(String(report.lcrStatus || '').trim().toLowerCase());
  const lcrAnnualOpportunity = (!lcrIsConfirmedOn && lcrSavings) ? lcrSavings.annual : 0;
  const reformAnnualOpportunity = reformSavings ? reformSavings.annual : 0;
  const totalAnnualOpportunity = (Number(lcrAnnualOpportunity) || 0) + (Number(reformAnnualOpportunity) || 0);
  return {
    debitPct,
    creditPct,
    debitVolume,
    creditVolume,
    lcrIsConfirmedOn,
    lcrAnnualOpportunity,
    reformAnnualOpportunity,
    totalAnnualOpportunity,
    totalMonthlyOpportunity: totalAnnualOpportunity / 12,
  };
}

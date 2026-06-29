// api/_lib/pit/normaliseFacts.js
// Converts the analyser output into the canonical facts object used by PIT.
// This does not add opinions. It only normalises names, numbers and missing fields.

import { numberOrNull } from './utils.js';

export function normaliseFacts(raw = {}) {
  const report = { ...(raw || {}) };

  const cardMix = report.cardMix && typeof report.cardMix === 'object' ? report.cardMix : {};
  const chargebacks = report.chargebacks && typeof report.chargebacks === 'object' ? report.chargebacks : null;

  const volume = numberOrNull(report.volume);
  const totalFees = numberOrNull(report.totalFees);
  const transactions = numberOrNull(report.transactions);

  return {
    provider: report.provider || null,
    period: report.period || null,
    volume,
    totalFees,
    effectiveRate: numberOrNull(report.effectiveRate) ?? ((volume && totalFees) ? (totalFees / volume) * 100 : null),
    transactions,
    averageTransactionValue: numberOrNull(report.averageTransactionValue) ?? ((volume && transactions) ? volume / transactions : null),
    monthlyFee: numberOrNull(report.monthlyFee),
    terminalFees: numberOrNull(report.terminalFees),
    perTransactionFee: numberOrNull(report.perTransactionFee),
    pricingModel: report.pricingModel || null,
    providerRate: report.providerRate || null,
    lcrStatus: report.lcrStatus || null,
    cardMix: {
      debit: numberOrNull(cardMix.debit),
      credit: numberOrNull(cardMix.credit),
      amex: numberOrNull(cardMix.amex),
      foreign: numberOrNull(cardMix.foreign),
    },
    feeBreakdown: Array.isArray(report.feeBreakdown) ? report.feeBreakdown : [],
    setup: Array.isArray(report.setup) ? report.setup : [],
    chargebacks: chargebacks ? {
      count: numberOrNull(chargebacks.count),
      amount: numberOrNull(chargebacks.amount),
      fees: numberOrNull(chargebacks.fees),
      ratio: numberOrNull(chargebacks.ratio),
    } : null,
    observations: Array.isArray(report.observations) ? report.observations.filter(Boolean) : [],
    surchargeDetected: Boolean(report.surchargeDetected || report.surcharging),
    raw: report
  };
}

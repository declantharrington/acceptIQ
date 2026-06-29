// api/_lib/report/core/applyOverrides.js
// Merges admin-approved corrections into extracted report facts.

export function applyAdminOverrides(report, overrides = {}) {
  const adminNotes = (overrides.adminNotes || '').trim();
  const numericFields = ['volume', 'totalFees', 'effectiveRate', 'transactions', 'monthlyFee', 'terminalFees', 'perTransactionFee'];
  const stringFields  = ['provider', 'period', 'providerRate', 'pricingModel', 'lcrStatus'];

  for (const k of numericFields) {
    if (overrides[k] !== undefined && overrides[k] !== null && overrides[k] !== '') {
      const n = Number(overrides[k]);
      if (!Number.isNaN(n)) report[k] = n;
    }
  }

  for (const k of stringFields) {
    if (typeof overrides[k] === 'string' && overrides[k].trim()) report[k] = overrides[k].trim();
  }

  if (Array.isArray(overrides.observations) && overrides.observations.length) {
    report.observations = overrides.observations.map(o => String(o).trim()).filter(Boolean);
  }

  if (overrides.cardMix && typeof overrides.cardMix === 'object') {
    report.cardMix = { ...(report.cardMix || {}), ...overrides.cardMix };
  }

  if ((overrides.effectiveRate === undefined || overrides.effectiveRate === '') && report.volume && report.totalFees) {
    report.effectiveRate = (Number(report.totalFees) / Number(report.volume)) * 100;
  }

  return { report, adminNotes };
}

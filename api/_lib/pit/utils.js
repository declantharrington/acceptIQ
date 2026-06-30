// api/_lib/pit/utils.js
// Shared helpers for the Payments Intelligence Terminal (PIT).

export const lower = v => String(v ?? '').trim().toLowerCase();

export function toNumber(v, fallback = null) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(String(v).replace(/[$,%\s,]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function round(n, places = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const p = 10 ** places;
  return Math.round(x * p) / p;
}

export function moneyBand(value) {
  const n = Number(value) || 0;
  if (n >= 50000) return 'High';
  if (n >= 10000) return 'Medium';
  if (n > 0) return 'Low';
  return 'Strategic';
}

export function confidenceRank(value) {
  return { Confirmed: 4, Likely: 3, Estimated: 2, 'Needs validation': 1, Unknown: 0 }[value] ?? 0;
}

export function urgencyRank(value) {
  return { High: 3, Medium: 2, Low: 1 }[value] ?? 0;
}

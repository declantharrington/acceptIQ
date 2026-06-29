// api/_lib/report/core/validation.js
// Lightweight safety checks for extracted facts.

export function logFeeReconciliation(facts) {
  const total = Number(facts.totalFees);
  const items = Array.isArray(facts.feeBreakdown) ? facts.feeBreakdown : [];
  if (!total || !items.length) return;
  const sum = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const pct = Math.abs(sum - total) / total * 100;
  if (pct > 5) {
    console.warn(`generate-report: fee reconciliation mismatch - breakdown ${sum.toFixed(2)} vs totalFees ${total.toFixed(2)} (${pct.toFixed(1)}%).`);
  }
}

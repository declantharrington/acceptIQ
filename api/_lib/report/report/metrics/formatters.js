// api/_lib/report/metrics/formatters.js
// Shared formatting helpers for report facts, prompt text and template output.

export function fmtD(n) {
  return n != null ? `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
}

export function fmtD0(n) {
  return n != null ? `$${Number(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}` : '-';
}

export function fmtP(n) {
  return n != null ? `${Number(n).toFixed(2)}%` : '-';
}

export function todayLong() {
  return new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function safeStoragePart(value, fallback = 'Unknown', maxLen = 30) {
  const cleaned = String(value || fallback)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, maxLen);
  return cleaned || fallback;
}

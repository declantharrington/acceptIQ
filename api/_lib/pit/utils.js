// api/_lib/pit/utils.js
// Small helpers shared across the Payments Intelligence Engine.

export const lower = v => String(v || '').trim().toLowerCase();

export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function includesAny(text, terms = []) {
  const s = lower(text);
  return terms.some(t => s.includes(lower(t)));
}

export function parseProgramContext(programContext = '') {
  const get = label => {
    const match = String(programContext).match(new RegExp(`${label}:\\s*(.+)`, 'i'));
    return match?.[1]?.trim() || null;
  };

  return {
    companyName: get('Company') || '-',
    contactName: get('Name') || '-',
    merchantEmail: get('Email') || '-',
    phone: get('Phone'),
    website: get('Website'),
    revenueBandRaw: get('Revenue') || get('Revenue band') || get('Turnover'),
    industry: get('Industry'),
    businessType: get('Business type') || get('Business model'),
    channel: get('Channel') || get('Sales channel'),
    raw: programContext || ''
  };
}

export function confidenceLabel(value) {
  const s = lower(value);
  if (['on', 'off', 'enabled', 'disabled', 'active', 'yes', 'no'].includes(s)) return 'Confirmed';
  if (s === 'unknown' || !s) return 'Needs validation';
  return 'Likely';
}

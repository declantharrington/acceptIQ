// api/_lib/report/core/audience.js
// Calibrates writing tone based on program context.

export function determineRevenueBand(programContext = '') {
  const ctxLower = String(programContext || '').toLowerCase();
  if (ctxLower.includes('50mplus')) return 'enterprise';
  if (ctxLower.includes('20to50m') || ctxLower.includes('5to20m')) return 'mid-market';
  return 'smb';
}

export function toneGuideFor(revenueBand) {
  return {
    enterprise: 'Reader is a CFO or Head of Finance. They are financially literate but not necessarily payments specialists, so still explain payments-specific terms in plain English the first time they appear. Be precise and data-driven; you may use dollar figures and basis points. Stay analytical and calm.',
    'mid-market': 'Reader is a business owner or finance manager. Balance technical accuracy with plain English. Lead with dollar impact, then explain the mechanism simply. Define any payments term on first use.',
    smb: 'Reader is a small business owner with limited payments knowledge. Plain English only - no jargon. Explain every concept in one simple line. Lead with the dollar impact and keep it concise and relatable.'
  }[revenueBand] || '';
}

// api/_lib/report/render/htmlHelpers.js
// Safe HTML utilities used by the report renderer.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin-bottom:12px">${p}</p>`)
    .join('');
}

export function replaceTokens(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value ?? '');
  }
  return html;
}

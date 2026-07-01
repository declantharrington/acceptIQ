// api/_lib/report/render/components.js
// Visual components used inside report templates. Presentation only.

import { escapeHtml } from './htmlHelpers.js';
import { fmtD, fmtD0 } from '../metrics/formatters.js';

export function buildFeeCompositionHtml(feeComposition) {
  if (!feeComposition) return '';

  const interchangePct = safePct(feeComposition.interchangePct);
  const schemePct = safePct(feeComposition.schemePct);
  const marginPct = safePct(feeComposition.providerMarginPct);

  return `
    <div class="composition-wrap">
      <div class="composition-bar">
        ${interchangePct > 0 ? `<div class="composition-seg interchange" style="width:${interchangePct}%"></div>` : ''}
        ${schemePct > 0 ? `<div class="composition-seg scheme" style="width:${schemePct}%"></div>` : ''}
        ${marginPct > 0 ? `<div class="composition-seg margin" style="width:${marginPct}%"></div>` : ''}
      </div>
      <div class="composition-legend">
        <div class="cl-item"><span class="cl-dot interchange"></span>Interchange <strong>${interchangePct}%</strong> (${fmtD(feeComposition.interchangeAmount)})</div>
        <div class="cl-item"><span class="cl-dot scheme"></span>Scheme fees <strong>${schemePct}%</strong> (${fmtD(feeComposition.schemeAmount)})</div>
        <div class="cl-item"><span class="cl-dot margin"></span>Provider margin &amp; other <strong>${marginPct}%</strong> (${fmtD(feeComposition.providerMarginAmount)})</div>
      </div>
    </div>`;
}

export function buildBenchmarkBarsHtml(benchmarkBars) {
  if (!benchmarkBars) return '';

  const rows = [
    { key: 'you', label: 'You (this statement)', cls: 'you', rowCls: 'is-you' },
    { key: 'smallBlended', label: 'Small, blended plan', cls: 'typical' },
    { key: 'smallUnblended', label: 'Small, unblended plan', cls: 'typical' },
    { key: 'large', label: 'Large / strategic rates', cls: 'strong' },
  ];

  return `
    <div class="benchmark-wrap">
      ${rows.map(row => {
        const item = benchmarkBars[row.key];
        if (!item || item.value == null) return '';
        const pct = Math.max(2, Math.min(100, Number(item.pct) || 0));
        return `<div class="bench-row">
          <div class="bench-row-label ${row.rowCls || ''}">${row.label}</div>
          <div class="bench-track"><div class="bench-fill ${row.cls}" style="width:${pct}%"></div></div>
          <div class="bench-row-val">${Number(item.value).toFixed(2)}%</div>
        </div>`;
      }).join('')}
    </div>`;
}

export function buildPriorityOpportunitiesHtml(priorityOpportunities = []) {
  if (!priorityOpportunities.length) {
    return '<div class="note-box">No material quantified opportunities were detected from the available statement data. A fuller review may still identify provider, gateway or contract opportunities.</div>';
  }

  return priorityOpportunities.map((o, idx) => `
    <div class="priority-card">
      <div class="priority-num">${idx + 1}</div>
      <div>
        <div class="priority-title">${escapeHtml(o.title)}</div>
        <div class="priority-meta">${escapeHtml(o.category || 'Opportunity')} · ${escapeHtml(o.urgency || 'Medium')} urgency</div>
        <div class="priority-evidence">${escapeHtml((o.evidence || []).join(' · ') || 'Evidence to be validated')}</div>
        <span class="confidence-pill">${escapeHtml(o.confidence || 'Needs validation')}</span>
      </div>
      <div class="priority-impact">Impact<strong>${o.estimatedAnnualValue ? fmtD0(o.estimatedAnnualValue) + '/yr' : escapeHtml(o.valueBand || 'Strategic')}</strong></div>
    </div>`).join('');
}

export function highestPriorityLabel(priorityOpportunities = []) {
  if (!priorityOpportunities[0]) return 'To validate';
  const id = priorityOpportunities[0].id || '';
  const labels = {
    'least-cost-routing': 'Least-cost routing',
    'october-reform': 'October reform',
    'surcharge-reform': 'Surcharge planning',
    'surcharge-planning': 'Surcharge planning',
    'pricing-structure': 'Pricing review',
    'chargebacks': 'Chargebacks',
    'chargeback-visibility': 'Chargeback visibility',
    'gateway-cost-visibility': 'Gateway visibility',
    'total-cost-visibility': 'Cost visibility'
  };
  return labels[id] || priorityOpportunities[0].title || 'To validate';
}

function safePct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

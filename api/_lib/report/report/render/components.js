// api/_lib/report/render/components.js
// Visual components used inside report templates.

import { escapeHtml } from './htmlHelpers.js';
import { fmtD, fmtD0 } from '../metrics/formatters.js';

export function buildFeeCompositionHtml(feeComposition) {
  if (!feeComposition) return '';
  return `
    <div class="composition-wrap">
      <div class="composition-bar">
        ${feeComposition.interchangePct > 0 ? `<div class="composition-seg interchange" style="width:${feeComposition.interchangePct}%"></div>` : ''}
        ${feeComposition.schemePct > 0 ? `<div class="composition-seg scheme" style="width:${feeComposition.schemePct}%"></div>` : ''}
        ${feeComposition.marginPct > 0 ? `<div class="composition-seg margin" style="width:${feeComposition.marginPct}%"></div>` : ''}
      </div>
      <div class="composition-legend">
        <div class="cl-item"><span class="cl-dot interchange"></span>Interchange <strong>${feeComposition.interchangePct}%</strong> (${fmtD(feeComposition.interchangeAmt)})</div>
        <div class="cl-item"><span class="cl-dot scheme"></span>Scheme fees <strong>${feeComposition.schemePct}%</strong> (${fmtD(feeComposition.schemeAmt)})</div>
        <div class="cl-item"><span class="cl-dot margin"></span>Provider margin &amp; other <strong>${feeComposition.marginPct}%</strong> (${fmtD(feeComposition.marginAmt)})</div>
      </div>
    </div>`;
}

export function buildBenchmarkBarsHtml(benchmarkBars) {
  if (!benchmarkBars) return '';
  return `
    <div class="benchmark-wrap">
      <div class="bench-row">
        <div class="bench-row-label is-you">You (this statement)</div>
        <div class="bench-track"><div class="bench-fill you" style="width:${benchmarkBars.you.pct}%"></div></div>
        <div class="bench-row-val">${benchmarkBars.you.value.toFixed(2)}%</div>
      </div>
      <div class="bench-row">
        <div class="bench-row-label">Small, blended plan</div>
        <div class="bench-track"><div class="bench-fill typical" style="width:${benchmarkBars.smallBlended.pct}%"></div></div>
        <div class="bench-row-val">${benchmarkBars.smallBlended.value.toFixed(2)}%</div>
      </div>
      <div class="bench-row">
        <div class="bench-row-label">Small, unblended plan</div>
        <div class="bench-track"><div class="bench-fill typical" style="width:${benchmarkBars.smallUnblended.pct}%"></div></div>
        <div class="bench-row-val">${benchmarkBars.smallUnblended.value.toFixed(2)}%</div>
      </div>
      <div class="bench-row">
        <div class="bench-row-label">Large / strategic rates</div>
        <div class="bench-track"><div class="bench-fill strong" style="width:${benchmarkBars.large.pct}%"></div></div>
        <div class="bench-row-val">${benchmarkBars.large.value.toFixed(2)}%</div>
      </div>
    </div>`;
}

export function buildPriorityOpportunitiesHtml(priorityOpportunities) {
  if (!priorityOpportunities.length) {
    return '<div class="note-box">No material quantified opportunities were detected from the available statement data. A fuller review may still identify provider, gateway or contract opportunities.</div>';
  }

  return priorityOpportunities.map((o, idx) => `
    <div class="priority-card">
      <div class="priority-num">${idx + 1}</div>
      <div>
        <div class="priority-title">${escapeHtml(o.title)}</div>
        <div class="priority-meta">${escapeHtml(o.category)} · ${escapeHtml(o.urgency)} urgency</div>
        <div class="priority-evidence">${escapeHtml((o.evidence || []).join(' · ') || 'Evidence to be validated')}</div>
        <span class="confidence-pill">${escapeHtml(o.confidence)}</span>
      </div>
      <div class="priority-impact">Impact<strong>${o.estimatedAnnualValue ? fmtD0(o.estimatedAnnualValue) + '/yr' : escapeHtml(o.valueBand || 'Strategic')}</strong></div>
    </div>`).join('');
}

export function highestPriorityLabel(priorityOpportunities) {
  return priorityOpportunities[0]
    ? priorityOpportunities[0].title.replace(/^(October 2026 |Debit routing \/ |Surcharge strategy before )/i, '').slice(0, 26)
    : 'To validate';
}

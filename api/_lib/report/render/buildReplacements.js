// api/_lib/report/render/buildReplacements.js
// PIT-native template replacement builder.
// This file maps PIT + narrative into report template tokens. It does not calculate intelligence.

import { fmtD, fmtD0, fmtP, todayLong } from '../metrics/formatters.js';
import { renderText } from './htmlHelpers.js';
import {
  buildBenchmarkBarsHtml,
  buildFeeCompositionHtml,
  buildPriorityOpportunitiesHtml,
  highestPriorityLabel
} from './components.js';

export function buildReplacements({
  pit = null,
  narrative = {},
  identity = {},
  // Backward-compatible fallback inputs only.
  report = null,
  metrics = null,
  priorityOpportunities = null
} = {}) {
  const facts = pit?.facts || report || {};
  const m = pit?.metrics || metrics || {};
  const opportunities = getPriorityOpportunities({ pit, priorityOpportunities });
  const snapshot = buildSnapshot({ pit, facts, metrics: m, priorityOpportunities: opportunities });

  const alertReplacements = buildAlertReplacements({ narrative, pit });
  const stackReplacements = buildStackReplacements({ narrative, pit });

  return {
    '{{provider}}': facts.provider || '-',
    '{{period}}': facts.period || '-',
    '{{effective_rate}}': fmtP(m.effectiveRate ?? facts.effectiveRate),
    '{{provider_rate}}': formatProviderRate(
      facts.providerRate ??
      pit?.paymentsStack?.providerMargin ??
      pit?.commercialIntelligence?.providerMargin?.observed
    ),
    '{{total_fees}}': fmtD(m.totalFees ?? facts.totalFees),
    '{{volume}}': fmtD(m.volume ?? facts.volume),
    '{{potential_savings_annual}}': snapshot.totalAnnualOpportunity > 0 ? fmtD0(snapshot.totalAnnualOpportunity) : 'To be confirmed',
    '{{highest_priority_label}}': highestPriorityLabel(opportunities),
    '{{potential_savings_monthly}}': snapshot.totalMonthlyOpportunity > 0 ? fmtD(snapshot.totalMonthlyOpportunity) : '-',
    '{{reform_savings_annual}}': m.reformSavings ? fmtD0(m.reformSavings.annual) : 'Not calculable',
    '{{lcr_savings_annual}}': (!snapshot.lcrIsConfirmedOn && m.lcrSavings) ? fmtD0(m.lcrSavings.annual) : 'Not applicable',
    '{{debit_volume_pct}}': formatPct(snapshot.debitPct),
    '{{debit_volume_amount}}': snapshot.debitVolume != null ? fmtD0(snapshot.debitVolume) : '-',
    '{{credit_volume_pct}}': formatPct(snapshot.creditPct),
    '{{credit_volume_amount}}': snapshot.creditVolume != null ? fmtD0(snapshot.creditVolume) : '-',
    '{{merchant_name}}': identity.companyName || pit?.merchantProfile?.name || 'Merchant',
    '{{contact_name}}': identity.contactName || pit?.merchantProfile?.contactName || '-',
    '{{merchant_email}}': identity.merchantEmail || pit?.merchantProfile?.contactEmail || '-',
    '{{report_date}}': todayLong(),
    '{{transactions}}': m.transactions ? Number(m.transactions).toLocaleString('en-AU') : (facts.transactions ? Number(facts.transactions).toLocaleString('en-AU') : '-'),
    '{{avg_fee_per_txn}}': fmtD(m.averageFeePerTransaction ?? m.avgFeePerTxn),
    '{{monthly_fee}}': fmtD(facts.monthlyFee),
    '{{terminal_fees}}': fmtD(facts.terminalFees),
    '{{pricing_model}}': pit?.commercialIntelligence?.pricingModel?.model || facts.pricingModel || pit?.paymentsStack?.pricingModel || '-',
    '{{lcr_status}}': pit?.paymentsStack?.lcrStatus || facts.lcrStatus || '-',
    '{{chargeback_ratio}}': (facts.chargebacks && facts.chargebacks.ratio != null) ? fmtP(facts.chargebacks.ratio) : 'Not shown on statement',
    '{{fee_composition}}': buildFeeCompositionHtml(m.feeComposition),
    '{{benchmark_bars}}': buildBenchmarkBarsHtml(m.benchmarkBars || buildBenchmarkBarsFromPosition(m.benchmarkPosition)),
    '{{landscape_preamble}}': renderText(narrative.landscapePreamble || fallbackLandscapePreamble(pit)),
    '{{executive_summary}}': renderText(narrative.executiveSummary || ''),
    '{{pricing_model_analysis}}': renderText(narrative.pricingModelAnalysis || fallbackModuleText(pit, 'pricing')),
    '{{savings_opportunity}}': renderText(narrative.savingsOpportunity || fallbackModuleText(pit, 'reform')),
    '{{lcr_analysis}}': renderText(narrative.lcrAnalysis || fallbackModuleText(pit, 'lcr')),
    '{{chargeback_analysis}}': renderText(narrative.chargebackAnalysis || fallbackModuleText(pit, 'chargebacks')),
    '{{surcharge_analysis}}': renderText(narrative.surchargeAnalysis || fallbackModuleText(pit, 'surcharge')),
    '{{benchmark_comment}}': renderText(narrative.benchmarkComment || fallbackModuleText(pit, 'benchmark')),
    '{{stack_assessment}}': renderText(narrative.stackAssessment || ''),
    '{{next_step_1}}': narrative.nextStep1 || '',
    '{{next_step_2}}': narrative.nextStep2 || '',
    '{{next_step_3}}': narrative.nextStep3 || '',
    '{{key_recommendation}}': narrative.keyRecommendation || pit?.commercialReasoning?.highestPriority?.rationale || '',
    '{{priority_opportunities}}': buildPriorityOpportunitiesHtml(opportunities),
    '{{alerts_html}}': buildAlertsHtml({ narrative, pit }),
    ...alertReplacements,
    ...stackReplacements,
  };
}

function getPriorityOpportunities({ pit, priorityOpportunities }) {
  if (Array.isArray(priorityOpportunities)) return priorityOpportunities;
  if (Array.isArray(pit?.priorityOpportunities)) return pit.priorityOpportunities;
  if (Array.isArray(pit?.caseSummary?.topOpportunities)) return pit.caseSummary.topOpportunities;
  if (Array.isArray(pit?.opportunities)) return pit.opportunities.slice(0, 4);
  return [];
}

function buildSnapshot({ pit, facts, metrics, priorityOpportunities }) {
  const totalAnnualOpportunity =
    Number(pit?.caseSummary?.quantifiedAnnualOpportunity) ||
    (priorityOpportunities || []).reduce((sum, o) => sum + (Number(o.estimatedAnnualValue) || 0), 0);

  return {
    totalAnnualOpportunity,
    totalMonthlyOpportunity: totalAnnualOpportunity > 0 ? totalAnnualOpportunity / 12 : 0,
    debitPct: metrics.cardMix?.debitPct ?? facts.cardMix?.debit ?? null,
    creditPct: metrics.cardMix?.creditPct ?? facts.cardMix?.credit ?? null,
    debitVolume: metrics.cardVolumes?.debit ?? null,
    creditVolume: metrics.cardVolumes?.credit ?? null,
    lcrIsConfirmedOn: /^(on|enabled|active|yes)$/i.test(facts.lcrStatus || pit?.paymentsStack?.lcrStatus || '')
  };
}

function buildBenchmarkBarsFromPosition(position) {
  if (!position || position.effectiveRate == null) return null;
  const refs = position.refs || { smallBlended: 1.4, smallUnblended: 0.9, largeStrategic: 0.6 };
  const you = Number(position.effectiveRate);
  const ceiling = Math.max(you || 0, refs.smallBlended || 1.4) * 1.15;
  const pct = v => Math.max(2, Math.round((Number(v) / ceiling) * 1000) / 10);
  return {
    you: { value: you, pct: pct(you) },
    smallBlended: { value: refs.smallBlended, pct: pct(refs.smallBlended) },
    smallUnblended: { value: refs.smallUnblended, pct: pct(refs.smallUnblended) },
    large: { value: refs.largeStrategic, pct: pct(refs.largeStrategic) },
  };
}

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(1)}%`;
}

function formatProviderRate(value) {
  if (value == null || value === '') return '-';
  const raw = String(value).trim();
  if (raw.includes('%')) return raw;
  const n = Number(raw);
  if (!Number.isNaN(n)) return `${n}%`;
  return raw;
}

function buildAlertReplacements({ narrative, pit }) {
  const alerts = Array.isArray(narrative.alerts) ? narrative.alerts : [];
  const fallback = buildFallbackAlerts(pit);
  const finalAlerts = alerts.length ? alerts : fallback;

  const alertClass = t => t === 'good' ? 'alert-good' : t === 'warn' ? 'alert-warn' : 'alert-info';
  const out = {};
  for (let i = 0; i < 3; i++) {
    const a = finalAlerts[i] || {};
    out[`{{key_finding_${i + 1}_class}}`] = alertClass(a.type);
    out[`{{key_finding_${i + 1}_heading}}`] = a.heading || '-';
    out[`{{key_finding_${i + 1}_body}}`] = a.body || '';
  }
  return out;
}

function buildFallbackAlerts(pit) {
  const findings = Array.isArray(pit?.findings) ? pit.findings : [];
  if (findings.length) {
    return findings.slice(0, 3).map(f => ({
      type: f.confidence === 'Confirmed' ? 'good' : f.confidence === 'Needs validation' ? 'warn' : 'info',
      heading: f.title,
      body: f.observation
    }));
  }

  const opportunities = Array.isArray(pit?.opportunities) ? pit.opportunities : [];
  return opportunities.slice(0, 3).map(o => ({
    type: o.confidence === 'Confirmed' ? 'good' : o.confidence === 'Needs validation' ? 'warn' : 'info',
    heading: o.title,
    body: (o.evidence || []).join(' · ') || 'Opportunity identified from the available payments data.'
  }));
}

function buildStackReplacements({ narrative, pit }) {
  const stackItems = Array.isArray(narrative.stackItems) ? narrative.stackItems : buildFallbackStackItems(pit);
  const statusLabel = { ok: '\u2713 OK', warn: '\u26A0 Review', gap: '\u2717 Gap' };
  const statusClass = { ok: 'td-status-ok', warn: 'td-status-warn', gap: 'td-status-gap' };
  const out = {};
  for (let i = 0; i < 5; i++) {
    const item = stackItems[i] || { label: '-', value: '-', status: 'ok' };
    out[`{{stack_item_${i + 1}_label}}`] = item.label;
    out[`{{stack_item_${i + 1}_value}}`] = item.value;
    out[`{{stack_item_${i + 1}_status}}`] = statusLabel[item.status] || item.status;
    out[`{{stack_item_${i + 1}_status_class}}`] = statusClass[item.status] || 'td-status-ok';
  }
  return out;
}

function buildFallbackStackItems(pit) {
  if (!pit) return [];
  return [
    { label: 'Pricing model', value: pit.paymentsStack?.pricingModel || '-', status: pit.paymentsStack?.pricingModel && pit.paymentsStack.pricingModel !== 'Unknown' ? 'ok' : 'warn' },
    { label: 'Provider margin', value: pit.paymentsStack?.providerMargin || pit.commercialIntelligence?.providerMargin?.observed || '-', status: pit.commercialIntelligence?.providerMargin?.position === 'Competitive' ? 'ok' : 'warn' },
    { label: 'Least-cost routing', value: pit.paymentsStack?.lcrStatus || 'Unknown', status: pit.paymentsStack?.lcrStatus === 'Unknown' ? 'warn' : 'ok' },
    { label: 'Gateway visibility', value: pit.paymentsStack?.gateway || 'Not visible', status: pit.paymentsStack?.gateway ? 'ok' : 'gap' },
    { label: 'Chargeback visibility', value: pit.paymentsStack?.chargebackVisibility || 'Not visible', status: pit.paymentsStack?.chargebackVisibility === 'Visible' ? 'ok' : 'warn' },
  ];
}

function fallbackLandscapePreamble(pit) {
  return pit?.industryIntelligence?.marketFacts?.map(f => f.fact).join('\n\n') || '';
}

function fallbackModuleText(pit, moduleId) {
  if (!pit) return '';
  const opp = (pit.opportunities || []).find(o => o.module === moduleId || o.id === moduleId);
  if (opp) {
    return `**What We Observed:** ${opp.evidence?.join(' ') || 'The PIT identified this area as relevant from the available data.'}\n\n**Commercial Relevance:** ${opp.title} is a ${opp.confidence || 'directional'} opportunity with ${opp.urgency || 'medium'} urgency.`;
  }
  if (moduleId === 'benchmark' && pit.metrics?.benchmarkPosition) {
    return `**How You Compare:** ${pit.metrics.benchmarkPosition.position || 'Benchmark position available from the effective rate.'}`;
  }
  return '';
}

// Builds the full alerts/data-gaps section HTML for the data-gaps-risk module.
// Combines narrative.alerts (Sonnet-written observations) with PIT data quality
// gaps, rendered as a series of alert boxes plus a data quality summary.
function buildAlertsHtml({ narrative, pit }) {
  const alerts = Array.isArray(narrative?.alerts) ? narrative.alerts : [];
  const dataQuality = pit?.dataQuality || null;
  const gaps = Array.isArray(dataQuality?.gaps) ? dataQuality.gaps : [];

  const alertClass = t => t === 'good' ? 'alert-good' : t === 'warn' ? 'alert-warn' : 'alert-info';

  const alertsHtml = alerts.map(a => `
    <div class="alert-card ${alertClass(a.type || 'info')}">
      <div class="alert-heading">${a.heading || ''}</div>
      <div class="alert-body">${a.body || ''}</div>
    </div>`).join('');

  const gapsHtml = gaps.length ? `
    <div class="section-sub" style="margin-top:20px">
      <p style="font-size:13px;font-weight:600;color:#555;margin-bottom:8px">Data limitations</p>
      ${gaps.filter(g => g.label).map(g => `<p style="font-size:13px;color:#666;margin-bottom:6px">· <strong>${g.label}</strong> — ${g.reason || 'Not visible on this statement.'}</p>`).join('')}
    </div>` : '';

  if (!alertsHtml && !gapsHtml) {
    return '<p style="font-size:13px;color:#666">No significant data gaps or risk flags identified from the available data.</p>';
  }

  return alertsHtml + gapsHtml;
}

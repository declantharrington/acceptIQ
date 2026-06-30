// api/_lib/report/render/buildReplacements.js
// Converts report state into template replacement tokens.

import { fmtD, fmtD0, fmtP, todayLong } from '../metrics/formatters.js';
import { renderText } from './htmlHelpers.js';
import {
  buildBenchmarkBarsHtml,
  buildFeeCompositionHtml,
  buildPriorityOpportunitiesHtml,
  highestPriorityLabel
} from './components.js';

export function buildReplacements({ report = {}, metrics = {}, narrative = {}, identity = {}, priorityOpportunities = [], pit = null }) {
  const snapshot = buildSnapshot({ report, metrics, priorityOpportunities, pit });

  const alertReplacements = buildAlertReplacements(narrative, pit);
  const stackReplacements = buildStackReplacements(narrative, pit);

  return {
    '{{provider}}': report.provider || '-',
    '{{period}}': report.period || '-',
    '{{effective_rate}}': fmtP(report.effectiveRate ?? metrics.effectiveRate),
    '{{provider_rate}}': formatProviderRate(report.providerRate ?? pit?.commercialIntelligence?.providerMargin?.observed),
    '{{total_fees}}': fmtD(report.totalFees ?? metrics.totalFees),
    '{{volume}}': fmtD(report.volume ?? metrics.volume),
    '{{potential_savings_annual}}': snapshot.totalAnnualOpportunity > 0 ? fmtD0(snapshot.totalAnnualOpportunity) : 'To be confirmed',
    '{{highest_priority_label}}': highestPriorityLabel(priorityOpportunities),
    '{{potential_savings_monthly}}': snapshot.totalMonthlyOpportunity > 0 ? fmtD(snapshot.totalMonthlyOpportunity) : '-',
    '{{reform_savings_annual}}': metrics.reformSavings ? fmtD0(metrics.reformSavings.annual) : 'Not calculable',
    '{{lcr_savings_annual}}': (!snapshot.lcrIsConfirmedOn && metrics.lcrSavings) ? fmtD0(metrics.lcrSavings.annual) : 'Not applicable',
    '{{debit_volume_pct}}': snapshot.debitPct != null && !Number.isNaN(snapshot.debitPct) ? `${Number(snapshot.debitPct).toFixed(1)}%` : '-',
    '{{debit_volume_amount}}': snapshot.debitVolume != null ? fmtD0(snapshot.debitVolume) : '-',
    '{{credit_volume_pct}}': snapshot.creditPct != null && !Number.isNaN(snapshot.creditPct) ? `${Number(snapshot.creditPct).toFixed(1)}%` : '-',
    '{{credit_volume_amount}}': snapshot.creditVolume != null ? fmtD0(snapshot.creditVolume) : '-',
    '{{merchant_name}}': identity.companyName || 'Merchant',
    '{{contact_name}}': identity.contactName || '-',
    '{{merchant_email}}': identity.merchantEmail || '-',
    '{{report_date}}': todayLong(),
    '{{transactions}}': report.transactions ? Number(report.transactions).toLocaleString('en-AU') : '-',
    '{{avg_fee_per_txn}}': fmtD(metrics.averageFeePerTransaction ?? metrics.avgFeePerTxn),
    '{{monthly_fee}}': fmtD(report.monthlyFee),
    '{{terminal_fees}}': fmtD(report.terminalFees),
    '{{pricing_model}}': report.pricingModel || pit?.commercialIntelligence?.pricingModel?.model || '-',
    '{{lcr_status}}': report.lcrStatus || pit?.paymentsStack?.lcrStatus || '-',
    '{{chargeback_ratio}}': (report.chargebacks && report.chargebacks.ratio != null) ? fmtP(report.chargebacks.ratio) : 'Not shown on statement',
    '{{fee_composition}}': buildFeeCompositionHtml(metrics.feeComposition),
    '{{benchmark_bars}}': buildBenchmarkBarsHtml(metrics.benchmarkBars || buildBenchmarkBarsFromPosition(metrics.benchmarkPosition)),
    '{{landscape_preamble}}': renderText(narrative.landscapePreamble || ''),
    '{{executive_summary}}': renderText(narrative.executiveSummary || ''),
    '{{pricing_model_analysis}}': renderText(narrative.pricingModelAnalysis || ''),
    '{{savings_opportunity}}': renderText(narrative.savingsOpportunity || ''),
    '{{lcr_analysis}}': renderText(narrative.lcrAnalysis || ''),
    '{{chargeback_analysis}}': renderText(narrative.chargebackAnalysis || ''),
    '{{surcharge_analysis}}': renderText(narrative.surchargeAnalysis || ''),
    '{{benchmark_comment}}': renderText(narrative.benchmarkComment || ''),
    '{{stack_assessment}}': renderText(narrative.stackAssessment || ''),
    '{{next_step_1}}': narrative.nextStep1 || '',
    '{{next_step_2}}': narrative.nextStep2 || '',
    '{{next_step_3}}': narrative.nextStep3 || '',
    '{{key_recommendation}}': narrative.keyRecommendation || pit?.commercialReasoning?.highestPriority?.rationale || '',
    '{{priority_opportunities}}': buildPriorityOpportunitiesHtml(priorityOpportunities),
    ...alertReplacements,
    ...stackReplacements,
  };
}

function buildSnapshot({ report, metrics, priorityOpportunities, pit }) {
  const totalAnnualOpportunity =
    Number(pit?.caseSummary?.quantifiedAnnualOpportunity) ||
    (priorityOpportunities || []).reduce((sum, o) => sum + (Number(o.estimatedAnnualValue) || 0), 0);

  return {
    totalAnnualOpportunity,
    totalMonthlyOpportunity: totalAnnualOpportunity > 0 ? totalAnnualOpportunity / 12 : 0,
    debitPct: metrics.cardMix?.debitPct ?? report.cardMix?.debit ?? null,
    creditPct: metrics.cardMix?.creditPct ?? report.cardMix?.credit ?? null,
    debitVolume: metrics.cardVolumes?.debit ?? null,
    creditVolume: metrics.cardVolumes?.credit ?? null,
    lcrIsConfirmedOn: /^(on|enabled|active|yes)$/i.test(report.lcrStatus || pit?.paymentsStack?.lcrStatus || '')
  };
}

function buildBenchmarkBarsFromPosition(position) {
  if (!position || position.effectiveRate == null) return null;
  const refs = position.refs || { smallBlended: 1.4, smallUnblended: 0.9, largeStrategic: 0.6 };
  const you = position.effectiveRate;
  const ceiling = Math.max(you, refs.smallBlended || 1.4) * 1.15;
  const pct = v => Math.max(2, Math.round((v / ceiling) * 1000) / 10);
  return {
    you: { value: you, pct: pct(you) },
    smallBlended: { value: refs.smallBlended, pct: pct(refs.smallBlended) },
    smallUnblended: { value: refs.smallUnblended, pct: pct(refs.smallUnblended) },
    large: { value: refs.largeStrategic, pct: pct(refs.largeStrategic) },
  };
}

function formatProviderRate(value) {
  if (value == null || value === '') return '-';
  const raw = String(value).trim();
  if (raw.includes('%')) return raw;
  const n = Number(raw);
  if (!Number.isNaN(n)) return `${n}%`;
  return raw;
}

function buildAlertReplacements(narrative, pit) {
  const alerts = Array.isArray(narrative.alerts) ? narrative.alerts : [];
  const fallback = (pit?.findings || []).slice(0, 3).map(f => ({
    type: f.confidence === 'Confirmed' ? 'good' : f.confidence === 'Needs validation' ? 'warn' : 'info',
    heading: f.title,
    body: f.observation
  }));
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

function buildStackReplacements(narrative, pit) {
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

// api/_lib/report/render/buildReplacements.js
// Converts report state into template replacement tokens.

import { fmtD, fmtD0, fmtP, todayLong } from '../metrics/formatters.js';
import { renderText } from './htmlHelpers.js';
import { buildBenchmarkBarsHtml, buildFeeCompositionHtml, buildPriorityOpportunitiesHtml, highestPriorityLabel } from './components.js';

export function buildReplacements({ report, metrics, narrative, identity, priorityOpportunities }) {
  const { snapshot } = metrics;

  const alertReplacements = buildAlertReplacements(narrative);
  const stackReplacements = buildStackReplacements(narrative);

  return {
    '{{provider}}': report.provider || '-',
    '{{period}}': report.period || '-',
    '{{effective_rate}}': fmtP(report.effectiveRate),
    '{{provider_rate}}': report.providerRate || '-',
    '{{total_fees}}': fmtD(report.totalFees),
    '{{volume}}': fmtD(report.volume),
    '{{potential_savings_annual}}': snapshot.totalAnnualOpportunity > 0 ? fmtD0(snapshot.totalAnnualOpportunity) : 'To be confirmed',
    '{{highest_priority_label}}': highestPriorityLabel(priorityOpportunities),
    '{{potential_savings_monthly}}': snapshot.totalMonthlyOpportunity > 0 ? fmtD(snapshot.totalMonthlyOpportunity) : '-',
    '{{reform_savings_annual}}': metrics.reformSavings ? fmtD0(metrics.reformSavings.annual) : 'Not calculable',
    '{{lcr_savings_annual}}': (!snapshot.lcrIsConfirmedOn && metrics.lcrSavings) ? fmtD0(metrics.lcrSavings.annual) : 'Not applicable',
    '{{debit_volume_pct}}': snapshot.debitPct != null && !Number.isNaN(snapshot.debitPct) ? `${snapshot.debitPct.toFixed(1)}%` : '-',
    '{{debit_volume_amount}}': snapshot.debitVolume != null ? fmtD0(snapshot.debitVolume) : '-',
    '{{credit_volume_pct}}': snapshot.creditPct != null && !Number.isNaN(snapshot.creditPct) ? `${snapshot.creditPct.toFixed(1)}%` : '-',
    '{{credit_volume_amount}}': snapshot.creditVolume != null ? fmtD0(snapshot.creditVolume) : '-',
    '{{merchant_name}}': identity.companyName,
    '{{contact_name}}': identity.contactName,
    '{{merchant_email}}': identity.merchantEmail,
    '{{report_date}}': todayLong(),
    '{{transactions}}': report.transactions ? Number(report.transactions).toLocaleString('en-AU') : '-',
    '{{avg_fee_per_txn}}': fmtD(metrics.avgFeePerTxn),
    '{{monthly_fee}}': fmtD(report.monthlyFee),
    '{{terminal_fees}}': fmtD(report.terminalFees),
    '{{pricing_model}}': report.pricingModel || '-',
    '{{lcr_status}}': report.lcrStatus || '-',
    '{{chargeback_ratio}}': (report.chargebacks && report.chargebacks.ratio != null) ? fmtP(report.chargebacks.ratio) : 'Not shown on statement',
    '{{fee_composition}}': buildFeeCompositionHtml(metrics.feeComposition),
    '{{benchmark_bars}}': buildBenchmarkBarsHtml(metrics.benchmarkBars),
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
    '{{key_recommendation}}': narrative.keyRecommendation || '',
    '{{priority_opportunities}}': buildPriorityOpportunitiesHtml(priorityOpportunities),
    ...alertReplacements,
    ...stackReplacements,
  };
}

function buildAlertReplacements(narrative) {
  const alerts = Array.isArray(narrative.alerts) ? narrative.alerts : [];
  const alertClass = t => t === 'good' ? 'alert-good' : t === 'warn' ? 'alert-warn' : 'alert-info';
  const out = {};
  for (let i = 0; i < 3; i++) {
    const a = alerts[i] || {};
    out[`{{key_finding_${i + 1}_class}}`] = alertClass(a.type);
    out[`{{key_finding_${i + 1}_heading}}`] = a.heading || '-';
    out[`{{key_finding_${i + 1}_body}}`] = a.body || '';
  }
  return out;
}

function buildStackReplacements(narrative) {
  const stackItems = Array.isArray(narrative.stackItems) ? narrative.stackItems : [];
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

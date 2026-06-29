// api/_lib/report/template/reportTemplate.js
// Modular report composer. The rules engine passes selected module ids; this
// file assembles the report from reusable page modules.

import { readFileSync } from 'node:fs';

const REPORT_CSS = readFileSync(new URL('./report.css', import.meta.url), 'utf8');

const logo = `
  <img
    src="https://www.acceptoriq.com.au/images/acceptorIQ-full-black.png"
    alt="acceptorIQ"
    class="report-logo"
  />`;

const pageHeader = `<div class="page-header">
  ${logo}
  <div class="page-header-meta">Payments Stack Analysis &middot; Confidential &middot; {{report_date}}</div>
</div>`;

const pageFooter = page => `<div class="page-footer">
  <div class="page-footer-left">acceptorIQ Advisory &middot; Confidential</div>
  <div class="page-footer-right">Page ${page}</div>
</div>`;

function contentPage(pageNo, inner) {
  return `<div class="page"><div class="content-page">${pageHeader}<main class="page-content">${inner}</main>${pageFooter(pageNo)}</div></div>`;
}

function coverPage() {
  return `<div class="page cover-page">
  <div class="cover">
    <div class="cover-logo-row">${logo}</div>
    <div class="cover-body">
      <div class="cover-eyebrow">Payments Review Report</div>
      <h1 class="cover-title">Payments Stack<br><span>Analysis</span></h1>
      <div class="cover-subtitle">{{provider}} &middot; {{period}}</div>
      <div class="cover-stats">
        <div class="cover-stat"><span class="cover-stat-val">{{effective_rate}}</span><span class="cover-stat-lbl">Effective Rate</span></div>
        <div class="cover-stat"><span class="cover-stat-val">{{total_fees}}</span><span class="cover-stat-lbl">Total Fees</span></div>
        <div class="cover-stat"><span class="cover-stat-val">{{volume}}</span><span class="cover-stat-lbl">Card Volume</span></div>
      </div>
      <div class="cover-divider"></div>
      <div class="cover-meta">
        <div><div class="cover-meta-label">Prepared for</div><div class="cover-meta-value">{{merchant_name}}</div></div>
        <div><div class="cover-meta-label">Contact</div><div class="cover-meta-value">{{contact_name}}</div></div>
        <div><div class="cover-meta-label">Report date</div><div class="cover-meta-value">{{report_date}}</div></div>
        <div><div class="cover-meta-label">Prepared by</div><div class="cover-meta-value">acceptorIQ Advisory</div></div>
        <div><div class="cover-meta-label">Classification</div><div class="cover-meta-value">Confidential</div></div>
      </div>
      <div class="cover-confidential">This report is prepared exclusively for {{merchant_name}} and contains confidential commercial analysis. Not for distribution.</div>
    </div>
  </div>
</div>`;
}

function executivePage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split">
      <div class="section-label">Executive Summary</div>
      <h2 class="section-title">Key takeaways</h2>
      <div class="section-body executive-copy">{{executive_summary}}</div>
    </section>
    <section class="insight-strip no-split">
      <div class="insight-card"><span class="insight-val">{{potential_savings_annual}}</span><span class="insight-lbl">Potential annual opportunity</span></div>
      <div class="insight-card"><span class="insight-val">{{highest_priority_label}}</span><span class="insight-lbl">Highest-priority validation</span></div>
      <div class="insight-card"><span class="insight-val">{{debit_volume_pct}}</span><span class="insight-lbl">Debit mix to review</span></div>
    </section>
    <section class="section no-split">
      <div class="landscape-strip">
        <div class="ls-item"><span class="ls-val">$1.8B</span><span class="ls-lbl">Surcharges paid/year</span></div>
        <div class="ls-item"><span class="ls-val">70%&rarr;15%</span><span class="ls-lbl">Cash use, 2007-2025</span></div>
        <div class="ls-item"><span class="ls-val">1 Oct 2026</span><span class="ls-lbl">RBA reforms begin</span></div>
      </div>
      <div class="section-body compact">{{landscape_preamble}}</div>
    </section>`);
}

function findingsPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Key Findings</div>
      <h2 class="section-title">What stands out</h2>
      <div class="alerts large-alerts">
        <div class="alert {{key_finding_1_class}}"><div class="alert-heading">{{key_finding_1_heading}}</div><div class="alert-body">{{key_finding_1_body}}</div></div>
        <div class="alert {{key_finding_2_class}}"><div class="alert-heading">{{key_finding_2_heading}}</div><div class="alert-body">{{key_finding_2_body}}</div></div>
        <div class="alert {{key_finding_3_class}}"><div class="alert-heading">{{key_finding_3_heading}}</div><div class="alert-body">{{key_finding_3_body}}</div></div>
      </div>
    </section>`);
}

function snapshotPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Operating Snapshot</div>
      <h2 class="section-title">What shapes the opportunity</h2>
      <div class="snapshot-grid">
        <div class="snapshot-card"><span class="snapshot-val">{{transactions}}</span><span class="snapshot-lbl">Transactions reviewed</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{avg_fee_per_txn}}</span><span class="snapshot-lbl">Average fee per transaction</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{provider_rate}}</span><span class="snapshot-lbl">Provider margin observed</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{pricing_model}}</span><span class="snapshot-lbl">Pricing structure</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{debit_volume_pct}}</span><span class="snapshot-lbl">Debit mix ({{debit_volume_amount}})</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{credit_volume_pct}}</span><span class="snapshot-lbl">Credit mix ({{credit_volume_amount}})</span></div>
      </div>
      <div class="note-box"><strong>Why these numbers matter:</strong> this page focuses on the drivers behind the cost picture rather than repeating the headline rate, fees and volume from the cover.</div>
    </section>`);
}

function feePage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Fee Analysis</div>
      <h2 class="section-title">Where your costs come from</h2>
      {{fee_composition}}
      <div class="insight-box"><strong>Largest cost driver:</strong> interchange is the wholesale cost layer passed through to the bank that issued your customer's card. When this line is the largest share of the bill, reform and pass-through become especially important.</div>
      <table class="data-table compact-table">
        <thead><tr><th style="width:42%">Component</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td class="td-label">Effective rate</td><td class="td-value">{{effective_rate}}</td></tr>
          <tr><td class="td-label">Provider rate / margin</td><td class="td-value">{{provider_rate}}</td></tr>
          <tr><td class="td-label">Total fees paid</td><td class="td-value">{{total_fees}}</td></tr>
          <tr><td class="td-label">Card volume processed</td><td class="td-value">{{volume}}</td></tr>
          <tr><td class="td-label">Total transactions</td><td class="td-value">{{transactions}}</td></tr>
          <tr><td class="td-label">Average fee per transaction</td><td class="td-value">{{avg_fee_per_txn}}</td></tr>
          <tr><td class="td-label">Monthly account fee</td><td class="td-value">{{monthly_fee}}</td></tr>
          <tr><td class="td-label">Terminal fees</td><td class="td-value">{{terminal_fees}}</td></tr>
          <tr><td class="td-label">Pricing model</td><td class="td-value">{{pricing_model}}</td></tr>
          <tr><td class="td-label">LCR status</td><td class="td-value">{{lcr_status}}</td></tr>
          <tr><td class="td-label">Chargeback ratio</td><td class="td-value">{{chargeback_ratio}}</td></tr>
        </tbody>
      </table>
    </section>`);
}

function stackPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Stack Component Review</div>
      <h2 class="section-title">How your stack is performing</h2>
      <table class="data-table stack-table">
        <thead><tr><th>Component</th><th>Current setup</th><th style="width:110px;text-align:center">Status</th></tr></thead>
        <tbody>
          ${[1,2,3,4,5].map(i => `<tr><td class="td-label">{{stack_item_${i}_label}}</td><td>{{stack_item_${i}_value}}</td><td class="{{stack_item_${i}_status_class}}">{{stack_item_${i}_status}}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`);
}

function pricingPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Pricing Model Assessment</div>
      <h2 class="section-title">How you're currently charged</h2>
      <div class="section-body">{{pricing_model_analysis}}</div>
    </section>`);
}

function reformPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Reform Opportunity</div>
      <h2 class="section-title">The October 2026 upside</h2>
      <div class="section-body">{{savings_opportunity}}</div>
    </section>`);
}

function lcrPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Least-Cost Routing</div>
      <h2 class="section-title">Debit routing and estimated impact</h2>
      <div class="section-body">{{lcr_analysis}}</div>
    </section>`);
}

function surchargePage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Surcharge Planning</div>
      <h2 class="section-title">Preparing for October 2026</h2>
      <div class="section-body">{{surcharge_analysis}}</div>
    </section>`);
}

function chargebacksPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Chargebacks</div>
      <h2 class="section-title">Visibility and risk</h2>
      <div class="section-body">{{chargeback_analysis}}</div>
    </section>`);
}

function benchmarkPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Market Benchmark</div>
      <h2 class="section-title">Your position against the market</h2>
      {{benchmark_bars}}
      <div class="section-body">{{benchmark_comment}}</div>
    </section>`);
}

function prioritiesPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section">
      <div class="section-label">Priority Opportunities</div>
      <h2 class="section-title">Recommended next actions</h2>
      <p class="lead-in">These are the highest-impact areas to validate in a payments review. They are starting points for a conversation, not prescribed changes.</p>
      <div class="priority-list">{{priority_opportunities}}</div>
      <div class="dark-callout"><div class="dark-callout-label">Priority area to discuss</div><div>{{key_recommendation}}</div></div>
    </section>`);
}

function ctaPage() {
  return `<div class="page cta-page">
  <div class="cta-logo-row">${logo}</div>
  <div class="cta-body">
    <div class="cta-eyebrow">Next Steps</div>
    <h1 class="cta-title">Let's turn insight<br><span>into savings.</span></h1>
    <p class="cta-copy">The report shows where the opportunities appear to be. A Payments Review turns those findings into a clear, practical action plan for your business.</p>
    <div class="cta-steps">
      <div><strong>Discuss this report</strong><span>A short conversation to walk through the findings and opportunities.</span></div>
      <div><strong>Validate and quantify</strong><span>We confirm the data, provider terms and implementation path.</span></div>
      <div><strong>Implement and save</strong><span>Your advisor helps you move from insight to outcome.</span></div>
    </div>
    <div class="cta-contact"><div><span>Book your payments review</span><strong>acceptoriq.com.au/book</strong></div><div><span>Email</span><strong>hello@acceptoriq.com.au</strong></div></div>
  </div>
  <div class="cta-footer">Prepared for {{merchant_name}} &middot; Attn: {{contact_name}} &middot; {{merchant_email}} &middot; {{report_date}}<br>Confidential &middot; acceptorIQ Advisory &middot; Not for distribution</div>
</div>`;
}

export function buildTemplate({ modules = [] } = {}) {
  let pageNo = 1;
  const pages = [coverPage()];
  const add = (id, fn) => { if (modules.includes(id)) pages.push(fn(pageNo++)); };

  add('executive', executivePage);
  add('findings', findingsPage);
  add('snapshot', snapshotPage);
  add('fee', feePage);
  add('stack', stackPage);
  add('pricing', pricingPage);
  add('reform', reformPage);
  add('lcr', lcrPage);
  add('surcharge', surchargePage);
  add('chargebacks', chargebacksPage);
  add('benchmark', benchmarkPage);
  add('priorities', prioritiesPage);
  if (modules.includes('cta')) pages.push(ctaPage());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>acceptorIQ - Payments Review Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${REPORT_CSS}</style>
</head>
<body>${pages.join('\n')}</body>
</html>`;
}

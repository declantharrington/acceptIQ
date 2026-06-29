// api/_lib/report/template/reportTemplate.js
// The HTML shell for the generated report.
// CSS lives in report.css so print/A4 layout changes do not require editing
// the API endpoint.

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

export function buildTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>acceptorIQ - Payments Review Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${REPORT_CSS}
</style>
</head>
<body>

<!-- PAGE 1 - COVER -->
<div class="page cover-page">
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
</div>

<!-- PAGE 2 - EXECUTIVE SUMMARY -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section no-split">
        <div class="section-label">Executive Summary</div>
        <h2 class="section-title">Key takeaways</h2>
        <div class="section-body executive-copy">{{executive_summary}}</div>
      </section>

      <section class="insight-strip no-split">
        <div class="insight-card"><span class="insight-val">{{potential_savings_annual}}</span><span class="insight-lbl">Potential annual opportunity</span></div>
        <div class="insight-card"><span class="insight-val">1 Oct 2026</span><span class="insight-lbl">RBA reforms begin</span></div>
        <div class="insight-card"><span class="insight-val">{{debit_volume_pct}}</span><span class="insight-lbl">Debit volume to review</span></div>
      </section>

      <section class="section no-split">
        <div class="landscape-strip">
          <div class="ls-item"><span class="ls-val">$1.8B</span><span class="ls-lbl">Surcharges paid/year</span></div>
          <div class="ls-item"><span class="ls-val">70%&rarr;15%</span><span class="ls-lbl">Cash use, 2007-2025</span></div>
          <div class="ls-item"><span class="ls-val">~20%</span><span class="ls-lbl">Debit cost reduction from LCR</span></div>
        </div>
        <div class="section-body compact">{{landscape_preamble}}</div>
      </section>
    </main>
    ${pageFooter(1)}
  </div>
</div>

<!-- PAGE 3 - KEY FINDINGS -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Key Findings</div>
        <h2 class="section-title">What stands out</h2>
        <div class="alerts large-alerts">
          <div class="alert {{key_finding_1_class}}"><div class="alert-heading">{{key_finding_1_heading}}</div><div class="alert-body">{{key_finding_1_body}}</div></div>
          <div class="alert {{key_finding_2_class}}"><div class="alert-heading">{{key_finding_2_heading}}</div><div class="alert-body">{{key_finding_2_body}}</div></div>
          <div class="alert {{key_finding_3_class}}"><div class="alert-heading">{{key_finding_3_heading}}</div><div class="alert-body">{{key_finding_3_body}}</div></div>
        </div>
      </section>
    </main>
    ${pageFooter(2)}
  </div>
</div>

<!-- PAGE 4 - KEY SNAPSHOT -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Operating Snapshot</div>
        <h2 class="section-title">What shapes the opportunity</h2>
        <div class="snapshot-grid">
          <div class="snapshot-card"><span class="snapshot-val">{{transactions}}</span><span class="snapshot-lbl">Total transactions reviewed</span></div>
          <div class="snapshot-card"><span class="snapshot-val">{{avg_fee_per_txn}}</span><span class="snapshot-lbl">Average fee per transaction</span></div>
          <div class="snapshot-card"><span class="snapshot-val">{{provider_rate}}</span><span class="snapshot-lbl">Provider margin observed</span></div>
          <div class="snapshot-card"><span class="snapshot-val">{{pricing_model}}</span><span class="snapshot-lbl">Pricing structure</span></div>
          <div class="snapshot-card"><span class="snapshot-val">{{debit_volume_pct}}</span><span class="snapshot-lbl">Debit mix ({{debit_volume_amount}})</span></div>
          <div class="snapshot-card"><span class="snapshot-val">{{credit_volume_pct}}</span><span class="snapshot-lbl">Credit mix ({{credit_volume_amount}})</span></div>
        </div>
        <div class="note-box"><strong>Why these numbers matter:</strong> this page focuses on the drivers behind the cost picture rather than repeating the headline rate, fees and volume from the cover.
      </section>
    </main>
    ${pageFooter(3)}
  </div>
</div>

<!-- PAGE 5 - FEE ANALYSIS -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
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
      </section>
    </main>
    ${pageFooter(4)}
  </div>
</div>

<!-- PAGE 6 - STACK COMPONENT REVIEW -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Stack Component Review</div>
        <h2 class="section-title">How your stack is performing</h2>
        <table class="data-table stack-table">
          <thead><tr><th style="width:28%">Component</th><th>Current setup</th><th style="width:16%;text-align:center">Status</th></tr></thead>
          <tbody>
            <tr><td class="td-label">{{stack_item_1_label}}</td><td>{{stack_item_1_value}}</td><td class="{{stack_item_1_status_class}}"><span>{{stack_item_1_status}}</span></td></tr>
            <tr><td class="td-label">{{stack_item_2_label}}</td><td>{{stack_item_2_value}}</td><td class="{{stack_item_2_status_class}}"><span>{{stack_item_2_status}}</span></td></tr>
            <tr><td class="td-label">{{stack_item_3_label}}</td><td>{{stack_item_3_value}}</td><td class="{{stack_item_3_status_class}}"><span>{{stack_item_3_status}}</span></td></tr>
            <tr><td class="td-label">{{stack_item_4_label}}</td><td>{{stack_item_4_value}}</td><td class="{{stack_item_4_status_class}}"><span>{{stack_item_4_status}}</span></td></tr>
            <tr><td class="td-label">{{stack_item_5_label}}</td><td>{{stack_item_5_value}}</td><td class="{{stack_item_5_status_class}}"><span>{{stack_item_5_status}}</span></td></tr>
          </tbody>
        </table>
      </section>
    </main>
    ${pageFooter(5)}
  </div>
</div>

<!-- PAGE 7 - PRICING MODEL -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Pricing Model Assessment</div>
        <h2 class="section-title">How you're currently charged</h2>
        <div class="section-body">{{pricing_model_analysis}}</div>
      </section>
    </main>
    ${pageFooter(6)}
  </div>
</div>

<!-- PAGE 8 - OPPORTUNITY & BENCHMARK -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content two-section-page">
      <section class="section">
        <div class="section-label">Reform Opportunity</div>
        <h2 class="section-title">The October 2026 upside</h2>
        <div class="section-body">{{savings_opportunity}}</div>
      </section>
      <section class="section">
        <div class="section-label">Market Benchmark</div>
        <h2 class="section-title">Your position against the market</h2>
        {{benchmark_bars}}
        <div class="section-body compact">{{benchmark_comment}}</div>
      </section>
    </main>
    ${pageFooter(7)}
  </div>
</div>

<!-- PAGE 9 - LCR & CHARGEBACKS -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Least-cost Routing</div>
        <h2 class="section-title">Debit routing and estimated impact</h2>
        <div class="section-body">{{lcr_analysis}}</div>
      </section>
      <section class="section">
        <div class="section-label">Chargebacks</div>
        <h2 class="section-title">Visibility and risk</h2>
        <div class="section-body compact">{{chargeback_analysis}}</div>
      </section>
      <section class="section">
        <div class="section-label">Payments Stack Assessment</div>
        <h2 class="section-title">What this says about your setup</h2>
        <div class="section-body compact">{{stack_assessment}}</div>
      </section>
    </main>
    ${pageFooter(8)}
  </div>
</div>

<!-- PAGE 10 - PRIORITY OPPORTUNITIES -->
<div class="page">
  <div class="content-page">
    ${pageHeader}
    <main class="page-content">
      <section class="section">
        <div class="section-label">Priority Opportunities</div>
        <h2 class="section-title">Recommended next actions</h2>
        <p class="lead-in">These are the highest-impact areas to validate in a payments review. They are starting points for a conversation, not prescribed changes.</p>
        <div class="rec-list">
          <div class="rec-item"><div class="rec-num">1</div><div class="rec-body">{{next_step_1}}</div></div>
          <div class="rec-item"><div class="rec-num">2</div><div class="rec-body">{{next_step_2}}</div></div>
          <div class="rec-item"><div class="rec-num">3</div><div class="rec-body">{{next_step_3}}</div></div>
        </div>
        <div class="key-rec-box"><div class="key-rec-label">Priority area to discuss</div><div class="key-rec-text">{{key_recommendation}}</div></div>
      </section>
    </main>
    ${pageFooter(9)}
  </div>
</div>

<!-- PAGE 11 - NEXT STEPS -->
<div class="page">
  <div class="cta-page">
    <div class="cta-page-logo-row">${logo}</div>
    <div class="cta-body">
      <div class="cta-eyebrow">Next Steps</div>
      <div class="cta-title">Let's turn insight<br>into savings.</div>
      <div class="cta-sub">The report shows where the opportunities appear to be. A Payments Review turns those findings into a clear, practical action plan for your business.</div>
      <div class="cta-steps">
        <div><strong>Discuss this report</strong><span>A short conversation to walk through the findings and opportunities.</span></div>
        <div><strong>Validate and quantify</strong><span>We confirm the data, provider terms and implementation path.</span></div>
        <div><strong>Implement and save</strong><span>Your advisor helps you move from insight to outcome.</span></div>
      </div>
      <div class="cta-divider"></div>
      <div class="cta-contacts"><div><div class="cta-contact-label">Book your Payments Review</div><div class="cta-contact-value">acceptoriq.com.au/book</div></div><div><div class="cta-contact-label">Email</div><div class="cta-contact-value">hello@acceptoriq.com.au</div></div></div>
      <div class="cta-divider"></div>
      <div class="cta-prepared">Prepared for <strong>{{merchant_name}}</strong> &nbsp;&middot;&nbsp; Attn: {{contact_name}} &nbsp;&middot;&nbsp; {{merchant_email}} &nbsp;&middot;&nbsp; {{report_date}}</div>
      <div class="cta-confidential">Confidential &middot; acceptorIQ Advisory &middot; Not for distribution</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

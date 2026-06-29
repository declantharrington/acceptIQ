// api/_lib/report/template/reportTemplate.js
// The HTML shell for the generated report.
// CSS lives in report.css so print/A4 layout changes do not require editing
// the API endpoint.

import { readFileSync } from 'node:fs';

const REPORT_CSS = readFileSync(new URL('./report.css', import.meta.url), 'utf8');

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

<!-- === PAGE 1 - COVER === -->
<div class="page">
<div class="cover">
<div class="cover-logo-row">
<img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:28px;width:auto;display:block;">
</div>
  <div class="cover-body">
    <div class="cover-eyebrow">Payments Review Report</div>
    <div class="cover-title">Payments Stack<br><span>Analysis</span></div>
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
    <div class="cover-confidential">
      This report is prepared exclusively for {{merchant_name}} and contains confidential commercial analysis. Not for distribution.
    </div>
  </div>
</div>
</div>

<!-- === PAGE 2 - EXECUTIVE SUMMARY (incl. short landscape intro) & KEY FINDINGS === -->
<div class="page">
<div class="content-page">
  <div class="page-header">
<div class="page-header-logo">
      <img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:18px;width:auto;display:block;">
    </div>
    <div class="page-header-meta">Payments Stack Analysis &middot; Confidential &middot; {{report_date}}</div>
  </div>
  <div class="page-content">
    <div class="stat-row">
      <div class="stat-card dark"><span class="stat-val">{{effective_rate}}</span><span class="stat-lbl">Effective Rate</span></div>
      <div class="stat-card"><span class="stat-val">{{total_fees}}</span><span class="stat-lbl">Total Fees</span></div>
      <div class="stat-card accent"><span class="stat-val">{{volume}}</span><span class="stat-lbl">Card Volume</span></div>
    </div>
    <div class="section">
      <div class="landscape-strip">
        <div class="ls-item"><span class="ls-val">$1.8B</span><span class="ls-lbl">Surcharges paid/year</span></div>
        <div class="ls-item"><span class="ls-val">70%&rarr;15%</span><span class="ls-lbl">Cash use, 2007-2025</span></div>
        <div class="ls-item"><span class="ls-val">1 Oct 2026</span><span class="ls-lbl">RBA reforms begin</span></div>
      </div>
      <div class="section-body compact">{{landscape_preamble}}</div>
    </div>
    <div class="section">
      <div class="section-label">Executive Summary</div>
      <div class="section-body">{{executive_summary}}</div>
    </div>
    <div class="section">
      <div class="section-label">Key Findings</div>
      <div class="alerts">
        <div class="alert {{key_finding_1_class}}">
          <div class="alert-heading">{{key_finding_1_heading}}</div>
          <div class="alert-body">{{key_finding_1_body}}</div>
        </div>
        <div class="alert {{key_finding_2_class}}">
          <div class="alert-heading">{{key_finding_2_heading}}</div>
          <div class="alert-body">{{key_finding_2_body}}</div>
        </div>
        <div class="alert {{key_finding_3_class}}">
          <div class="alert-heading">{{key_finding_3_heading}}</div>
          <div class="alert-body">{{key_finding_3_body}}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <div class="page-footer-left">acceptorIQ Advisory &middot; Confidential</div>
    <div class="page-footer-right">Page 2</div>
  </div>
</div>
</div>

<!-- === PAGE 3 - FEE ANALYSIS & STACK COMPONENT REVIEW ===
     The two scannable tables, paired together and moved up from page 6 of
     the previous layout - these are the fastest, highest-value content for
     a reader to act on, so they shouldn't be five pages deep. === -->
<div class="page">
<div class="content-page">
<div class="page-header">
  <div class="page-header-logo">
    <img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:18px;width:auto;display:block;">
  </div>
  <div class="page-header-meta">Payments Stack Analysis &middot; Confidential &middot; {{report_date}}</div>
</div>
  <div class="page-content">
    <div class="section">
      <div class="section-label">Fee Analysis</div>
      {{fee_composition}}
      <table class="data-table">
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
    </div>
    <div class="section">
      <div class="section-label">Stack Component Review</div>
      <table class="data-table">
        <thead>
          <tr><th style="width:28%">Component</th><th>Current Setup</th><th style="width:14%;text-align:center">Status</th></tr>
        </thead>
        <tbody>
          <tr><td class="td-label">{{stack_item_1_label}}</td><td>{{stack_item_1_value}}</td><td class="{{stack_item_1_status_class}}">{{stack_item_1_status}}</td></tr>
          <tr><td class="td-label">{{stack_item_2_label}}</td><td>{{stack_item_2_value}}</td><td class="{{stack_item_2_status_class}}">{{stack_item_2_status}}</td></tr>
          <tr><td class="td-label">{{stack_item_3_label}}</td><td>{{stack_item_3_value}}</td><td class="{{stack_item_3_status_class}}">{{stack_item_3_status}}</td></tr>
          <tr><td class="td-label">{{stack_item_4_label}}</td><td>{{stack_item_4_value}}</td><td class="{{stack_item_4_status_class}}">{{stack_item_4_status}}</td></tr>
          <tr><td class="td-label">{{stack_item_5_label}}</td><td>{{stack_item_5_value}}</td><td class="{{stack_item_5_status_class}}">{{stack_item_5_status}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="page-footer">
    <div class="page-footer-left">acceptorIQ Advisory &middot; Confidential</div>
    <div class="page-footer-right">Page 3</div>
  </div>
</div>
</div>

<!-- === PAGE 4 - PRICING MODEL, SAVINGS OPPORTUNITY & MARKET BENCHMARK === -->
<div class="page">
<div class="content-page">
  <div class="page-header">
<div class="page-header-logo">
      <img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:18px;width:auto;display:block;">
    </div>
    <div class="page-header-meta">Payments Stack Analysis &middot; Confidential &middot; {{report_date}}</div>
  </div>
  <div class="page-content">
    <div class="section">
      <div class="section-label">Pricing Model Assessment</div>
      <div class="section-body">{{pricing_model_analysis}}</div>
    </div>
    <div class="section">
      <div class="section-label">Opportunity Overview</div>
      <div class="section-body">{{savings_opportunity}}</div>
    </div>
    <div class="section">
      <div class="section-label">Market Benchmark</div>
      {{benchmark_bars}}
      <div class="section-body">{{benchmark_comment}}</div>
    </div>
  </div>
  <div class="page-footer">
    <div class="page-footer-left">acceptorIQ Advisory &middot; Confidential</div>
    <div class="page-footer-right">Page 4</div>
  </div>
</div>
</div>

<!-- === PAGE 5 - LCR, CHARGEBACKS, STACK ASSESSMENT & AREAS TO EXPLORE === -->
<div class="page">
<div class="content-page">
  <div class="page-header">
<div class="page-header-logo">
      <img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:18px;width:auto;display:block;">
    </div>
    <div class="page-header-meta">Payments Stack Analysis &middot; Confidential &middot; {{report_date}}</div>
  </div>
  <div class="page-content">
    <div class="section">
      <div class="section-label">Least Cost Routing</div>
      <div class="section-body">{{lcr_analysis}}</div>
    </div>
    <div class="section">
      <div class="section-label">Chargebacks</div>
      <div class="section-body">{{chargeback_analysis}}</div>
    </div>
    <div class="section">
      <div class="section-label">Payments Stack Assessment</div>
      <div class="section-body compact">{{stack_assessment}}</div>
    </div>
    <div class="section">
      <div class="section-label">Areas to Explore</div>
      <div class="lead-in" style="font-size:12.5px;margin-bottom:16px">These are areas where our analysis suggests there may be value worth examining more closely. They are starting points for a conversation, not prescribed changes.</div>
      <div class="rec-list">
        <div class="rec-item"><div class="rec-num">1</div><div class="rec-body">{{next_step_1}}</div></div>
        <div class="rec-item"><div class="rec-num">2</div><div class="rec-body">{{next_step_2}}</div></div>
        <div class="rec-item"><div class="rec-num">3</div><div class="rec-body">{{next_step_3}}</div></div>
      </div>
      <div class="key-rec-box">
        <div class="key-rec-label">Priority area to discuss</div>
        <div class="key-rec-text">{{key_recommendation}}</div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <div class="page-footer-left">acceptorIQ Advisory &middot; Confidential</div>
    <div class="page-footer-right">Page 5</div>
  </div>
</div>
</div>

<!-- === PAGE 6 - NEXT STEPS & CONTACT === -->
<div class="page">
  <div class="cta-page">
    <div class="cta-page-logo-row">
      <img src="https://www.acceptoriq.com.au/acceptorIQ-full-black.png" alt="acceptorIQ" style="height:28px;width:auto;display:block;">
    </div>

    <div class="cta-body">
      <div class="cta-eyebrow">Next Steps</div>

      <div class="cta-title">Let's turn these findings<br>into real savings.</div>

      <div class="cta-sub">
        This report shows where the opportunities appear to be. The next step is a Payments Review: your acceptorIQ advisor will walk you through the findings, explain what each area means for your business and discuss the practical options available to you.
      </div>

      <div class="cta-divider"></div>

      <div class="cta-contacts">
        <div>
          <div class="cta-contact-label">Book your Payments Review</div>
          <div class="cta-contact-value">acceptoriq.com.au/book</div>
        </div>
        <div>
          <div class="cta-contact-label">Email</div>
          <div class="cta-contact-value">hello@acceptoriq.com.au</div>
        </div>
      </div>

      <div class="cta-divider"></div>

      <div class="cta-prepared">
        Prepared for <strong>{{merchant_name}}</strong>
        &nbsp;&middot;&nbsp; Attn: {{contact_name}}
        &nbsp;&middot;&nbsp; {{merchant_email}} &nbsp;&middot;&nbsp; {{report_date}}
      </div>

      <div class="cta-confidential">Confidential &middot; acceptorIQ Advisory &middot; Not for distribution</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

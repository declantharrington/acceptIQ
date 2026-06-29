// api/_lib/report/template/reportTemplate.js
// Report Engine v2: builds a commercial narrative that moves from market context
// to merchant facts, then into selected diagnostic modules and opportunities.

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

function contentPage(pageNo, inner, extraClass = '') {
  return `<div class="page"><div class="content-page ${extraClass}">${pageHeader}<main class="page-content">${inner}</main>${pageFooter(pageNo)}</div></div>`;
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

function landscapePage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split landscape-hero">
      <div class="section-label">Australian Payments Landscape</div>
      <h2 class="section-title large">Payments have changed. Most merchant pricing has not.</h2>
      <div class="section-body landscape-copy">{{landscape_preamble}}</div>
    </section>
    <section class="landscape-grid no-split">
      <div class="landscape-card"><span class="landscape-val">70% &rarr; 15%</span><span class="landscape-lbl">Cash share of in-person payments, 2007 to 2025</span></div>
      <div class="landscape-card"><span class="landscape-val">$1.8B</span><span class="landscape-lbl">Estimated card surcharges paid by Australians each year</span></div>
      <div class="landscape-card"><span class="landscape-val">1 Oct 2026</span><span class="landscape-lbl">Major surcharge and interchange reforms begin</span></div>
      <div class="landscape-card"><span class="landscape-val">~20%</span><span class="landscape-lbl">Typical debit cost reduction available from least-cost routing</span></div>
    </section>
    <section class="note-box landscape-note no-split"><strong>Why this matters:</strong> payments costs are recurring, complex and often set once then left alone. The merchants that understand their stack are better positioned to protect margin as regulation, customer behaviour and provider pricing change.</section>
  `, 'landscape-page');
}

function takeawaysPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split">
      <div class="section-label">Key Takeaways From Your Data</div>
      <h2 class="section-title">What stands out</h2>
      <p class="lead-in">These are the headline observations from the statement and questionnaire responses. The detailed evidence follows in the diagnostic sections.</p>
      <div class="takeaway-grid">
        <div class="takeaway-card {{key_finding_1_class}}"><div class="takeaway-kicker">Takeaway 1</div><div class="alert-heading">{{key_finding_1_heading}}</div><div class="alert-body">{{key_finding_1_body}}</div></div>
        <div class="takeaway-card {{key_finding_2_class}}"><div class="takeaway-kicker">Takeaway 2</div><div class="alert-heading">{{key_finding_2_heading}}</div><div class="alert-body">{{key_finding_2_body}}</div></div>
        <div class="takeaway-card {{key_finding_3_class}}"><div class="takeaway-kicker">Takeaway 3</div><div class="alert-heading">{{key_finding_3_heading}}</div><div class="alert-body">{{key_finding_3_body}}</div></div>
      </div>
    </section>
    <section class="insight-strip no-split">
      <div class="insight-card"><span class="insight-val">{{potential_savings_annual}}</span><span class="insight-lbl">Potential annual opportunity</span></div>
      <div class="insight-card"><span class="insight-val">{{highest_priority_label}}</span><span class="insight-lbl">Highest-priority validation</span></div>
      <div class="insight-card"><span class="insight-val">{{debit_volume_pct}}</span><span class="insight-lbl">Debit mix to review</span></div>
    </section>
  `);
}

function snapshotPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split">
      <div class="section-label">Operating Snapshot</div>
      <h2 class="section-title">What shapes the opportunity</h2>
      <div class="snapshot-grid compact-snapshot">
        <div class="snapshot-card"><span class="snapshot-val">{{transactions}}</span><span class="snapshot-lbl">Transactions reviewed</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{avg_fee_per_txn}}</span><span class="snapshot-lbl">Average fee per transaction</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{provider_rate}}</span><span class="snapshot-lbl">Provider margin observed</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{pricing_model}}</span><span class="snapshot-lbl">Pricing structure</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{debit_volume_pct}}</span><span class="snapshot-lbl">Debit mix ({{debit_volume_amount}})</span></div>
        <div class="snapshot-card"><span class="snapshot-val">{{credit_volume_pct}}</span><span class="snapshot-lbl">Credit mix ({{credit_volume_amount}})</span></div>
      </div>
    </section>
    <section class="section no-split fee-mini-section">
      <div class="section-label">Fee Analysis</div>
      <h2 class="section-title">Where your costs come from</h2>
      {{fee_composition}}
      <div class="insight-box"><strong>Largest cost driver:</strong> interchange is the wholesale cost layer passed through to the bank that issued your customer's card. When this line is the largest share of the bill, reform and pass-through become especially important.</div>
    </section>
  `);
}

function stackPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split">
      <div class="section-label">Stack Component Review</div>
      <h2 class="section-title">How your stack is performing</h2>
      <table class="data-table stack-table">
        <thead><tr><th>Component</th><th>Current setup</th><th style="width:110px;text-align:center">Status</th></tr></thead>
        <tbody>
          ${[1,2,3,4,5].map(i => `<tr><td class="td-label">{{stack_item_${i}_label}}</td><td>{{stack_item_${i}_value}}</td><td class="{{stack_item_${i}_status_class}}">{{stack_item_${i}_status}}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>
  `);
}

const moduleDefinitions = {
  pricing: {
    label: 'Pricing Model Assessment',
    title: "How you're currently charged",
    body: '{{pricing_model_analysis}}'
  },
  reform: {
    label: 'Reform Opportunity',
    title: 'The October 2026 upside',
    body: '{{savings_opportunity}}'
  },
  lcr: {
    label: 'Least-Cost Routing',
    title: 'Debit routing and estimated impact',
    body: '{{lcr_analysis}}'
  },
  surcharge: {
    label: 'Surcharge Planning',
    title: 'Preparing for October 2026',
    body: '{{surcharge_analysis}}'
  },
  chargebacks: {
    label: 'Chargebacks',
    title: 'Visibility and risk',
    body: '{{chargeback_analysis}}'
  },
  benchmark: {
    label: 'Market Benchmark',
    title: 'Your position against the market',
    body: '{{benchmark_bars}}<div class="section-body">{{benchmark_comment}}</div>'
  }
};

function moduleSection(id) {
  const m = moduleDefinitions[id];
  if (!m) return '';
  return `<section class="section diagnostic-section module-${id}">
    <div class="section-label">${m.label}</div>
    <h2 class="section-title">${m.title}</h2>
    <div class="section-body module-body">${m.body}</div>
  </section>`;
}

function diagnosticPages(moduleIds) {
  const ids = moduleIds.filter(id => moduleDefinitions[id]);
  const pages = [];
  for (let i = 0; i < ids.length; i += 2) {
    pages.push(ids.slice(i, i + 2).map(moduleSection).join('\n'));
  }
  return pages;
}

function prioritiesPage(pageNo) {
  return contentPage(pageNo, `
    <section class="section no-split">
      <div class="section-label">Opportunity Summary</div>
      <h2 class="section-title">Where the value appears to be</h2>
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
    <h1 class="cta-title">Turn the review<br><span>into action.</span></h1>
    <p class="cta-copy">The report has identified the areas that appear most worth validating. A Payments Review turns those findings into a clear action plan for your business.</p>
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
  const has = id => modules.includes(id);

  if (has('landscape')) pages.push(landscapePage(pageNo++));
  if (has('takeaways')) pages.push(takeawaysPage(pageNo++));
  if (has('snapshot')) pages.push(snapshotPage(pageNo++));
  if (has('stack')) pages.push(stackPage(pageNo++));

  const diagnosticIds = ['pricing', 'reform', 'lcr', 'surcharge', 'chargebacks', 'benchmark'].filter(has);
  for (const inner of diagnosticPages(diagnosticIds)) {
    pages.push(contentPage(pageNo++, inner, 'diagnostic-page'));
  }

  if (has('priorities')) pages.push(prioritiesPage(pageNo++));
  if (has('cta')) pages.push(ctaPage());

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

// api/generate-report.js
// Triggered when admin approves a submission.
// Fetches the HTML template, populates it with real merchant data, stores in Supabase.
//
// Report philosophy (keep in sync with the acceptorIQ Knowledge Base):
//   The client-facing report is a DIAGNOSTIC, not a prescription. It opens the
//   merchant's eyes to where money may be leaking and how large the opportunity
//   could be - WITHOUT naming the specific fix, the provider to move to, or the
//   exact change to make. That "how" is the paid consulting conversation. The
//   report must also read in plain English for a non-expert business owner, and
//   open with a general Australian-payments-landscape preamble.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';
import { buildSystemPrompt } from './_lib/report/prompt/reportSystemPrompt.js';
import { buildTemplate } from './_lib/report/template/reportTemplate.js';

export const config = {
  // Sonnet can take 20-40s+ on a long report; match analyse.js so the function
  // isn't killed mid-generation by the platform default timeout.
  maxDuration: 120,
};

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { submissionId, overrides = {} } = req.body || {};
    if (!submissionId) return res.status(400).json({ error: 'submissionId required' });

    const supabaseUrl  = process.env.SUPABASE_URL;
    const supabaseKey  = process.env.SUPABASE_ANON_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      console.error('generate-report: missing required environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Latest Sonnet. (analyse.js intentionally stays on Haiku for cheaper extraction.)
    const MODEL = 'claude-sonnet-4-6';

    // -- 1. Fetch submission from Supabase -------------------------
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/submissions?id=eq.${submissionId}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const rows = await fetchRes.json();
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission     = rows[0];
    const report         = JSON.parse(submission.report_json || '{}');
    const programContext = submission.program_context || '';

    // -- 1b. Apply admin overrides from the dashboard edit panel ---
    // The admin can correct extracted facts (e.g. a misread total) and add
    // internal notes before generating. Only whitelisted fact fields are merged.
    const adminNotes = (overrides.adminNotes || '').trim();
    const numericFields = ['volume', 'totalFees', 'effectiveRate', 'transactions', 'monthlyFee', 'terminalFees', 'perTransactionFee'];
    const stringFields  = ['provider', 'period', 'providerRate', 'pricingModel', 'lcrStatus'];
    for (const k of numericFields) {
      if (overrides[k] !== undefined && overrides[k] !== null && overrides[k] !== '') {
        const n = Number(overrides[k]);
        if (!Number.isNaN(n)) report[k] = n;
      }
    }
    for (const k of stringFields) {
      if (typeof overrides[k] === 'string' && overrides[k].trim()) report[k] = overrides[k].trim();
    }
    if (Array.isArray(overrides.observations) && overrides.observations.length) {
      report.observations = overrides.observations.map(o => String(o).trim()).filter(Boolean);
    }
    if (overrides.cardMix && typeof overrides.cardMix === 'object') {
      report.cardMix = { ...(report.cardMix || {}), ...overrides.cardMix };
    }
    // Recompute effective rate from corrected volume/totalFees unless the admin
    // set it explicitly, so a corrected total flows through to the headline rate.
    if ((overrides.effectiveRate === undefined || overrides.effectiveRate === '') &&
        report.volume && report.totalFees) {
      report.effectiveRate = (Number(report.totalFees) / Number(report.volume)) * 100;
    }

    // -- 2. Determine revenue band for tone calibration ------------
    const ctxLower = programContext.toLowerCase();
    const revenueBand = (() => {
      if (ctxLower.includes('50mplus')) return 'enterprise';
      if (ctxLower.includes('20to50m') || ctxLower.includes('5to20m')) return 'mid-market';
      return 'smb';
    })();

    // Tone calibrates DEPTH and sophistication by audience - but every band must
    // stay plain-English about payments concepts (the reader may know finance,
    // not payments) and must stay non-prescriptive (open eyes, don't instruct).
    const toneGuide = {
      enterprise:
        'Reader is a CFO or Head of Finance. They are financially literate but not necessarily payments specialists, so still explain payments-specific terms (interchange, scheme fees, routing) in plain English the first time they appear. Be precise and data-driven; you may use dollar figures and basis points. Stay analytical and calm.',
      'mid-market':
        'Reader is a business owner or finance manager. Balance technical accuracy with plain English. Lead with dollar impact, then explain the mechanism simply. Define any payments term on first use.',
      smb:
        'Reader is a small business owner with limited payments knowledge. Plain English only - no jargon. Explain every concept in one simple line. Lead with the dollar impact and keep it concise and relatable (e.g. "on every $100 you take by card...").',
    }[revenueBand];

    const fmtD = n => n != null ? `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
    const fmtP = n => n != null ? `${Number(n).toFixed(2)}%` : '-';
    const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

    // Average fee per transaction = average sale value (volume/transactions) x effective rate.
    // This is a DOLLAR value (the average fee on an average sale), NOT a fixed
    // per-transaction interchange fee (those are quoted in cents). See guardrails.
    const avgFeePerTxn = (() => {
      if (report.volume && report.transactions && report.effectiveRate) {
        return (report.volume / report.transactions) * (report.effectiveRate / 100);
      }
      if (report.perTransactionFee != null) return report.perTransactionFee / 100; // fallback (cents -> $)
      return null;
    })();

    // -- Fee composition bar (visual) --------------------------------
    // Derived deterministically from feeBreakdown, NOT left to the AI to
    // estimate - matches line items by keyword into the three MSF buckets
    // from the Knowledge Base (interchange / scheme fees / acquirer margin).
    // Returns null if the breakdown doesn't clearly separate these, so the
    // visual is only shown when it can be drawn honestly.
    const feeComposition = (() => {
      const items = Array.isArray(report.feeBreakdown) ? report.feeBreakdown : [];
      if (!items.length) return null;
      let interchange = 0, scheme = 0, margin = 0, other = 0;
      for (const item of items) {
        const label = (item.label || '').toLowerCase();
        const amt = Number(item.amount) || 0;
        if (/interchange/.test(label)) interchange += amt;
        else if (/scheme/.test(label)) scheme += amt;
        else if (/margin|merchant service fee|msf|provider/.test(label)) margin += amt;
        else other += amt;
      }
      const total = interchange + scheme + margin + other;
      if (total <= 0) return null;
      // Fold "other" proportionally into margin rather than adding a fourth
      // segment - the chart stays a clean 3-part story (issuer / network /
      // provider) which matches how the report explains the MSF elsewhere.
      margin += other;
      return {
        interchangePct: Math.round((interchange / total) * 1000) / 10,
        schemePct:      Math.round((scheme / total) * 1000) / 10,
        marginPct:      Math.round((margin / total) * 1000) / 10,
        interchangeAmt: interchange,
        schemeAmt:      scheme,
        marginAmt:      margin,
      };
    })();

    // -- Pricing model classification, verified against the actual fee
    // breakdown ------------------------------------------------------------
    // report.pricingModel comes from the earlier extraction step (analyse.js)
    // reading the statement's own labelling, and that label can be wrong -
    // extraction reads what the provider CALLS the plan, not what the itemised
    // numbers structurally show. Per Knowledge Base section 7: Interchange-plus-plus
    // (IC++) itemises interchange, scheme fees AND a margin as three SEPARATE
    // line items; Interchange-plus (IC+) separates out interchange but folds
    // scheme fees into a single markup with the margin (no separate scheme
    // line). A statement showing all three as distinct line items is
    // structurally IC++ regardless of what label the extraction step picked up.
    //
    // This is corrected here, in code, rather than left for the narrative
    // model to "notice and describe correctly" - the Fee Analysis table's
    // {{pricing_model}} cell is a direct passthrough of report.pricingModel
    // with no LLM involved, so asking the model to silently use a different,
    // corrected label in its prose would just create a new contradiction
    // between the table and the narrative instead of fixing the original one.
    // Correcting the fact itself, once, keeps every downstream consumer
    // (the table, the narrative prompt, and the persisted Supabase record)
    // in agreement automatically.
    (() => {
      if (!feeComposition) return;
      const hasInterchange = feeComposition.interchangeAmt > 0;
      const hasScheme       = feeComposition.schemeAmt > 0;
      const hasMargin       = feeComposition.marginAmt > 0;
      let derived = null;
      if (hasInterchange && hasScheme && hasMargin) derived = 'Interchange-plus-plus';
      else if (hasInterchange && hasMargin && !hasScheme) derived = 'Interchange-plus';
      if (derived && report.pricingModel && derived !== report.pricingModel) {
        console.warn(`generate-report: pricingModel mismatch - extracted "${report.pricingModel}", fee breakdown structurally shows "${derived}". Using the derived value.`);
        report.pricingModel = derived;
      } else if (derived && !report.pricingModel) {
        report.pricingModel = derived;
      }
    })();

    // -- Benchmark comparison bar (visual) ---------------------------
    // Fixed reference points from the Knowledge Base section 6 (small-blended 1.4%,
    // small-unblended 0.9%, large/strategic 0.6%), plotted against the
    // merchant's own effective rate on a shared scale. Scale ceiling is
    // padded above the highest of the four values so no bar ever touches 100%.
    const benchmarkBars = (() => {
      if (report.effectiveRate == null) return null;
      const you = report.effectiveRate;
      const refs = { smallBlended: 1.4, smallUnblended: 0.9, large: 0.6 };
      const ceiling = Math.max(you, refs.smallBlended) * 1.15;
      const pct = v => Math.max(2, Math.round((v / ceiling) * 1000) / 10); // floor so tiny bars stay visible
      return {
        you: { value: you, pct: pct(you) },
        smallBlended: { value: refs.smallBlended, pct: pct(refs.smallBlended) },
        smallUnblended: { value: refs.smallUnblended, pct: pct(refs.smallUnblended) },
        large: { value: refs.large, pct: pct(refs.large) },
      };
    })();

    // -- Reform savings estimate (visual + narrative fact) -----------
    // Computed deterministically - NOT left to the model to estimate in prose.
    // This directly fixes a real bug: without a single computed anchor, the
    // model was independently re-estimating the October 2026 consumer-credit
    // interchange opportunity in more than one narrative field and landing on
    // two different dollar figures for the same underlying opportunity (one
    // generated report cited "$3,000-$4,500/month" in the executive summary
    // and "$1,190/month" in the opportunity-overview section). Computing it
    // once in code and threading the exact figure through the prompt removes
    // the inconsistency at the source, rather than just asking the model to
    // "be consistent" across a multi-field JSON generation.
    //
    // Methodology - uses the Knowledge Base section 3 approved AVERAGE-to-cap delta:
    // today's ~0.47% average domestic consumer credit interchange falling to
    // the confirmed 0.30% cap from 1 October 2026, applied to the merchant's
    // own credit card turnover (volume x credit% of card mix). This is the
    // same conservative "average merchant" framing the report already favours
    // - deliberately NOT the cap-to-cap delta (0.80%->0.30%), which would
    // overstate the saving for merchants who aren't already paying near the
    // current 0.80% ceiling.
    const reformSavings = (() => {
      const creditPct = report.cardMix && report.cardMix.credit != null ? Number(report.cardMix.credit) : null;
      if (!report.volume || creditPct == null || Number.isNaN(creditPct) || creditPct <= 0) return null;
      const creditTurnover = Number(report.volume) * (creditPct / 100);
      const CURRENT_AVG_RATE = 0.47; // % - Knowledge Base section 3
      const NEW_CAP_RATE     = 0.30; // % - Knowledge Base section 3, confirmed reform, 1 Oct 2026
      const monthly = creditTurnover * ((CURRENT_AVG_RATE - NEW_CAP_RATE) / 100);
      if (monthly <= 0) return null;
      return { creditTurnover, monthly, annual: monthly * 12 };
    })();

    // -- LCR (least-cost routing) savings estimate -------------------
    // Computed deterministically, same rationale as reformSavings above: this
    // is frequently one of the largest single opportunities on a debit-heavy
    // statement, sometimes larger than the October 2026 reform figure, and it
    // was previously left as an unquantified aside ("that is a material
    // number worth understanding") instead of a concrete dollar estimate -
    // which undersells what can be a genuinely major finding.
    //
    // Methodology, grounded in Knowledge Base section 5/13: LCR reduces the
    // cost of accepting DEBIT specifically by ~20% (RBA estimate). Statements
    // don't generally break out a debit-specific fee figure, so the debit fee
    // component is approximated as (debit turnover x the merchant's own
    // blended effective rate) - a reasonable stand-in given the data
    // available, and one the prompt is told explicitly to treat as an
    // estimate rather than a precise figure.
    const lcrSavings = (() => {
      const debitPct = report.cardMix && report.cardMix.debit != null ? Number(report.cardMix.debit) : null;
      if (!report.volume || !report.effectiveRate || debitPct == null || Number.isNaN(debitPct) || debitPct <= 0) return null;
      const debitTurnover = Number(report.volume) * (debitPct / 100);
      const estDebitFees = debitTurnover * (Number(report.effectiveRate) / 100);
      const LCR_REDUCTION = 0.20; // Knowledge Base section 5 - RBA estimate
      const monthly = estDebitFees * LCR_REDUCTION;
      if (monthly <= 0) return null;
      return { debitTurnover, estDebitFees, monthly, annual: monthly * 12 };
    })();

    // -- 3. Call Claude to write personalised narrative ------------
    // The acceptorIQ Knowledge Base is prepended as authoritative reference for
    // all Australian payments facts, benchmarks and the report philosophy. The
    // condensed instructions that follow it are the operative rules for THIS task.
    const systemPrompt = buildSystemPrompt({ paymentsKb: PAYMENTS_KB, toneGuide });

    const facts = report; // the analyser now returns facts only

    // Fee reconciliation (log-only safety net). totalFees should be the
    // statement's stated GST-inclusive total; if a feeBreakdown is present it
    // should sum to ~totalFees. A material gap is logged so a bad extraction is
    // visible at generation time (submit.js flags it visibly pre-approval).
    (() => {
      const total = Number(facts.totalFees);
      const items = Array.isArray(facts.feeBreakdown) ? facts.feeBreakdown : [];
      if (!total || !items.length) return;
      const sum = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const pct = Math.abs(sum - total) / total * 100;
      if (pct > 5) console.warn(`generate-report: fee reconciliation mismatch - breakdown ${sum.toFixed(2)} vs totalFees ${total.toFixed(2)} (${pct.toFixed(1)}%).`);
    })();

    const cardMix = facts.cardMix || {};
    const cardMixStr = Object.entries(cardMix)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(', ') || '-';
    const feeBreakdownStr = Array.isArray(facts.feeBreakdown) && facts.feeBreakdown.length
      ? facts.feeBreakdown.map(f => `${f.label}: ${fmtD(f.amount)}`).join('\n')
      : '-';
    const setupStr = Array.isArray(facts.setup) && facts.setup.length
      ? facts.setup.map(s => `${s.label}: ${s.value}`).join('\n')
      : '-';
    const observationsStr = Array.isArray(facts.observations) && facts.observations.length
      ? facts.observations.map(o => `- ${o}`).join('\n')
      : '-';
    // Chargebacks are sparse data - most statements won't show this at all.
    // Say so explicitly rather than letting the model infer "not shown" as
    // "zero chargebacks", which would be a fabricated claim of a clean record.
    const cb = facts.chargebacks || null;
    const chargebackStr = cb
      ? [
          cb.count  != null ? `Count: ${cb.count}` : null,
          cb.ratio  != null ? `Ratio: ${cb.ratio.toFixed(2)}% of transactions` : null,
          cb.amount != null ? `Disputed amount: ${fmtD(cb.amount)}` : null,
          cb.fees   != null ? `Chargeback fees charged: ${fmtD(cb.fees)}` : null,
        ].filter(Boolean).join('\n') || 'Not shown on this statement.'
      : 'Not shown on this statement - this does NOT mean zero chargebacks occurred, only that this data point is not visible here.';

    // Stated as a fixed fact for the model to quote verbatim - see the
    // "REFORM SAVINGS FIGURE" instruction in the system prompt above.
    const reformSavingsStr = reformSavings
      ? `Based on credit card turnover of ${fmtD(reformSavings.creditTurnover)} and the confirmed average-to-cap interchange reduction (0.47% average today -> 0.30% cap from 1 October 2026): approximately ${fmtD(reformSavings.monthly)} per month, or approximately ${fmtD(reformSavings.annual)} per year. Use this figure exactly, every time you cite a dollar size for this opportunity.`
      : 'Not calculable - no usable credit-card-mix percentage available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';

    // Stated as a fixed fact for the model to quote verbatim - see the
    // "LCR SAVINGS FIGURE" instruction in the system prompt above. Whether
    // this is presented as a live opportunity depends on lcrStatus, which is
    // given alongside it so the model can apply that gating itself.
    const lcrSavingsStr = lcrSavings
      ? `Based on debit card turnover of ${fmtD(lcrSavings.debitTurnover)}, an estimated current debit fee cost of approximately ${fmtD(lcrSavings.estDebitFees)} (debit turnover x this merchant's own blended effective rate, used as a stand-in since debit-specific fees aren't broken out on the statement), and the RBA's ~20% LCR debit-cost reduction estimate: approximately ${fmtD(lcrSavings.monthly)} per month, or approximately ${fmtD(lcrSavings.annual)} per year. This is an ESTIMATE (the underlying debit fee figure is approximated, not read directly off the statement) - say so if you state the figure. Only present this as a live opportunity if LCR status (given above) is not confirmed "On".`
      : 'Not calculable - no usable debit-card-mix percentage and/or effective rate available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';

    const userMessage = `Write a personalised payments review for this merchant, using ONLY the facts below plus the Knowledge Base for context, benchmarks and interpretation. The facts come from the merchant's own statement; everything interpretive (findings, opinions, narrative, framing) is yours to add.

STATEMENT FACTS:
Provider: ${facts.provider || '-'}
Period: ${facts.period || '-'}
Card volume: ${fmtD(facts.volume)}
Total fees: ${fmtD(facts.totalFees)}
Effective rate: ${fmtP(facts.effectiveRate)}
Transactions: ${facts.transactions || '-'}
Average transaction value: ${fmtD(facts.averageTransactionValue)}
Average fee per transaction (avg sale value x effective rate): ${fmtD(avgFeePerTxn)} - a DOLLAR value, NOT a fixed per-transaction fee
Monthly fee: ${fmtD(facts.monthlyFee)}
Terminal fees: ${fmtD(facts.terminalFees)}
Fixed per-transaction fee (if any): ${facts.perTransactionFee != null ? facts.perTransactionFee + 'c' : '-'}
Pricing model (verified against the itemised fee breakdown - this is authoritative, not just the statement's own label): ${facts.pricingModel || '-'}
Provider rate / margin (observed): ${facts.providerRate || '-'}
LCR status (observed): ${facts.lcrStatus || '-'}
Card mix: ${cardMixStr}

REFORM SAVINGS ESTIMATE (computed - use this EXACT figure, do not recompute or estimate a different number):
${reformSavingsStr}

LCR SAVINGS ESTIMATE (computed - use this EXACT figure, do not recompute or estimate a different number):
${lcrSavingsStr}

CHARGEBACKS:
${chargebackStr}

FEE BREAKDOWN (as printed):
${feeBreakdownStr}

CURRENT SETUP (factual components):
${setupStr}

FACTUAL OBSERVATIONS FROM THE STATEMENT:
${observationsStr}

MERCHANT PROFILE:
${programContext}${adminNotes ? `

ADMIN NOTES (internal context from the acceptorIQ reviewer - use to inform the analysis, but do NOT quote or attribute these in the report):
${adminNotes}` : ''}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 12000, // headroom for the larger JSON (preamble + multi-paragraph fields)
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!claudeRes.ok) {
      const detail = await claudeRes.text();
      throw new Error(`Claude error: ${claudeRes.status} ${detail}`);
    }
    const claudeData = await claudeRes.json();

    if (claudeData.stop_reason === 'max_tokens') {
      console.warn('generate-report: narrative hit max_tokens - JSON may be truncated. Raise max_tokens.');
    }

    const rawText = claudeData.content?.find(b => b.type === 'text')?.text || '';
    let narrative;
    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd   = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('no JSON object found');
      narrative = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      console.error('generate-report: failed to parse narrative JSON:', parseErr.message);
      console.error('Raw model output (first 500 chars):', rawText.slice(0, 500));
      throw new Error('Failed to parse narrative from model output');
    }

    // -- 4. Load the HTML template ---------------------------------
    let html = buildTemplate();

    // -- 5. Helper to convert narrative text to HTML ---------------
    function renderText(text) {
      if (!text) return '';
      return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')   // **heading:** -> <strong>
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p style="margin-bottom:12px">${p}</p>`)
        .join('');
    }

    // -- 6. Build alert (Key Findings) replacements ----------------
    // Findings are now produced by the generator (it has the Knowledge Base for
    // benchmark-based judgement). Colour follows the alert's OWN type.
    const alerts = Array.isArray(narrative.alerts) ? narrative.alerts : [];
    const alertClass = t =>
      t === 'good' ? 'alert-good' : t === 'warn' ? 'alert-warn' : 'alert-info';

    const alertReplacements = {};
    for (let i = 0; i < 3; i++) {
      const a = alerts[i] || {};
      alertReplacements[`{{key_finding_${i + 1}_class}}`]   = alertClass(a.type);
      alertReplacements[`{{key_finding_${i + 1}_heading}}`] = a.heading || '-';
      alertReplacements[`{{key_finding_${i + 1}_body}}`]    = a.body || '';
    }

    // -- 7. Build stack item replacements --------------------------
    // Stack components + statuses are produced by the generator (status needs
    // Knowledge Base benchmarks). Status colour follows the item's OWN status.
    const stackItems  = Array.isArray(narrative.stackItems) ? narrative.stackItems : [];
    const statusLabel = { ok: '\u2713 OK', warn: '\u26A0 Review', gap: '\u2717 Gap' };
    const statusClass = { ok: 'td-status-ok', warn: 'td-status-warn', gap: 'td-status-gap' };
    const stackReplacements = {};
    for (let i = 0; i < 5; i++) {
      const item = stackItems[i] || { label: '-', value: '-', status: 'ok' };
      stackReplacements[`{{stack_item_${i + 1}_label}}`]        = item.label;
      stackReplacements[`{{stack_item_${i + 1}_value}}`]        = item.value;
      stackReplacements[`{{stack_item_${i + 1}_status}}`]       = statusLabel[item.status] || item.status;
      stackReplacements[`{{stack_item_${i + 1}_status_class}}`] = statusClass[item.status] || 'td-status-ok';
    }

    // -- 8. Merchant identity (from program context) ---------------
    // This is a B2B product - the report is prepared FOR THE COMPANY, with the
    // individual who submitted it recorded as the contact, not the addressee.
    const companyName  = programContext.match(/Company:\s*(.+)/)?.[1]?.trim() || '-';
    const contactName  = programContext.match(/Name:\s*(.+)/)?.[1]?.trim() || '-';
    const merchantEmail = programContext.match(/Email:\s*(.+)/)?.[1]?.trim() || '-';

    // -- Build the fee composition bar HTML (or empty string if not derivable) --
    const compositionHtml = feeComposition ? `
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
      </div>` : '';

    // -- Build the benchmark comparison bar HTML (or empty string) --
    const benchmarkBarHtml = benchmarkBars ? `
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
      </div>` : '';

    // -- 9. Build full replacement map -----------------------------
    const replacements = {
      '{{provider}}':               report.provider || '-',
      '{{period}}':                 report.period || '-',
      '{{effective_rate}}':         fmtP(report.effectiveRate),
      '{{provider_rate}}':          report.providerRate || '-',
      '{{total_fees}}':             fmtD(report.totalFees),
      '{{volume}}':                 fmtD(report.volume),
      '{{merchant_name}}':          companyName,
      '{{contact_name}}':           contactName,
      '{{merchant_email}}':         merchantEmail,
      '{{report_date}}':            today,
      '{{transactions}}':           report.transactions ? Number(report.transactions).toLocaleString('en-AU') : '-',
      '{{avg_fee_per_txn}}':        fmtD(avgFeePerTxn),
      '{{monthly_fee}}':            fmtD(report.monthlyFee),
      '{{terminal_fees}}':          fmtD(report.terminalFees),
      '{{pricing_model}}':          report.pricingModel || '-',
      '{{lcr_status}}':             report.lcrStatus || '-',
      '{{chargeback_ratio}}':       (report.chargebacks && report.chargebacks.ratio != null) ? fmtP(report.chargebacks.ratio) : 'Not shown on statement',
      '{{fee_composition}}':        compositionHtml,
      '{{benchmark_bars}}':         benchmarkBarHtml,
      '{{landscape_preamble}}':     renderText(narrative.landscapePreamble   || ''),
      '{{executive_summary}}':      renderText(narrative.executiveSummary     || ''),
      '{{pricing_model_analysis}}': renderText(narrative.pricingModelAnalysis || ''),
      '{{savings_opportunity}}':    renderText(narrative.savingsOpportunity   || ''),
      '{{lcr_analysis}}':           renderText(narrative.lcrAnalysis          || ''),
      '{{chargeback_analysis}}':    renderText(narrative.chargebackAnalysis   || ''),
      '{{benchmark_comment}}':      renderText(narrative.benchmarkComment     || ''),
      '{{stack_assessment}}':       renderText(narrative.stackAssessment      || ''),
      '{{next_step_1}}':            narrative.nextStep1         || '',
      '{{next_step_2}}':            narrative.nextStep2         || '',
      '{{next_step_3}}':            narrative.nextStep3         || '',
      '{{key_recommendation}}':     narrative.keyRecommendation || '',
      ...alertReplacements,
      ...stackReplacements,
    };

    for (const [key, value] of Object.entries(replacements)) {
      html = html.split(key).join(value);
    }

    // -- 10. Store completed HTML in Supabase Storage --------------
    const timestamp    = Date.now();
    const safeName     = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
    const safeProvider = (report.provider || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 20);
    const htmlPath     = `reports/${safeName}_${safeProvider}_${timestamp}.html`;

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/statements/${htmlPath}`, {
      method: 'POST',
      headers: {
        apikey:         supabaseKey,
        Authorization:  `Bearer ${supabaseKey}`,
        'Content-Type': 'text/html',
        'x-upsert':     'true'
      },
      body: html
    });
    if (!uploadRes.ok) {
      const detail = await uploadRes.text();
      throw new Error(`Storage upload failed: ${uploadRes.status} ${detail}`);
    }

    // -- 11. Update submission status ------------------------------
    // Persist the (possibly admin-corrected) facts back to report_json and the
    // indexed columns so the dashboard list/modal reflect any edits made here.
    await fetch(`${supabaseUrl}/rest/v1/submissions?id=eq.${submissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey:         supabaseKey,
        Authorization:  `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        status:           'approved',
        report_narrative: JSON.stringify(narrative),
        report_html_path: htmlPath,
        report_json:      JSON.stringify(report),
        provider:         report.provider ?? null,
        period:           report.period ?? null,
        volume:           report.volume ?? null,
        total_fees:       report.totalFees ?? null,
        effective_rate:   report.effectiveRate ?? null,
        pricing_model:    report.pricingModel ?? null,
        lcr_status:       report.lcrStatus ?? null,
        chargeback_ratio: (report.chargebacks && report.chargebacks.ratio) ?? null
      })
    });

    return res.status(200).json({ success: true, htmlPath });

  } catch (err) {
    // Log the full stack (not just .message) so a future failure is fully
    // diagnosable from Vercel logs in one read, and guard against a thrown
    // value that isn't a proper Error (e.g. a string or undefined).
    const message = err && err.message ? err.message : String(err);
    console.error('generate-report error:', message);
    if (err && err.stack) console.error(err.stack);
    return res.status(500).json({ error: message });
  }
}

// ================================================================
//  HTML TEMPLATE
//  Page order: 1 Cover - 2 Exec Summary (+ landscape intro, Key Findings)
//              - 3 Fee Analysis + Stack Component Review - 4 Pricing Model
//              + Savings Opportunity + Market Benchmark - 5 LCR + Chargebacks
//              + Stack Assessment + Areas to Explore - 6 CTA
//  (Reorganised from the previous 7-page version: the landscape preamble no
//  longer gets its own dedicated page - it's a short intro on the executive
//  summary page - and the Stack Component Review table moved from page 6 to
//  page 3, much earlier, since the scannable tables are the easiest content
//  for a reader to act on and shouldn't be buried near the end.)
// ================================================================

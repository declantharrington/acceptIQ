// api/_lib/report/narrative/buildUserMessage.js
// Builds the user message sent to Claude.
// Narrative generation explains PIT conclusions. It does not decide opportunities or module selection.

import { fmtD, fmtP } from '../metrics/formatters.js';

function describeChargebacks(facts) {
  const cb = facts.chargebacks || null;
  if (!cb) return 'Not shown on this statement - this does NOT mean zero chargebacks occurred, only that this data point is not visible here.';
  return [
    cb.count  != null ? `Count: ${cb.count}` : null,
    cb.ratio  != null ? `Ratio: ${Number(cb.ratio).toFixed(2)}% of transactions` : null,
    cb.amount != null ? `Disputed amount: ${fmtD(cb.amount)}` : null,
    cb.fees   != null ? `Chargeback fees charged: ${fmtD(cb.fees)}` : null,
  ].filter(Boolean).join('\n') || 'Not shown on this statement.';
}

function describeReformSavings(reformSavings) {
  return reformSavings
    ? `Based on credit card turnover of ${fmtD(reformSavings.creditTurnover)} and the confirmed average-to-cap interchange reduction (0.47% average today -> 0.30% cap from 1 October 2026): approximately ${fmtD(reformSavings.monthly)} per month, or approximately ${fmtD(reformSavings.annual)} per year. Use this figure exactly, every time you cite a dollar size for this opportunity.`
    : 'Not calculable - no usable credit-card-mix percentage available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';
}

function describeLcrSavings(lcrSavings) {
  return lcrSavings
    ? `Based on debit card turnover of ${fmtD(lcrSavings.debitTurnover)}, an estimated current debit fee cost of approximately ${fmtD(lcrSavings.estimatedDebitFees)} (debit turnover x this merchant's own blended effective rate, used as a stand-in since debit-specific fees may not be broken out), and the RBA's ~20% LCR debit-cost reduction estimate: approximately ${fmtD(lcrSavings.monthly)} per month, or approximately ${fmtD(lcrSavings.annual)} per year. This is an ESTIMATE - say so if you state the figure. Only present this as a live opportunity if LCR status is not confirmed "On".`
    : 'Not calculable - no usable debit-card-mix percentage and/or effective rate available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';
}

export function buildUserMessage({
  report = {},
  metrics = {},
  selectedModules = [],
  priorityOpportunities = [],
  programContext = '',
  adminNotes = '',
  pit = null
}) {
  const facts = pit?.facts || report;
  const m = pit?.metrics || metrics;
  const modules = selectedModules.length
    ? selectedModules
    : Array.isArray(pit?.modulePlan)
      ? pit.modulePlan.map(x => x.id)
      : [];
  const opportunities = priorityOpportunities.length
    ? priorityOpportunities
    : pit?.priorityOpportunities || pit?.caseSummary?.topOpportunities || pit?.opportunities?.slice(0, 4) || [];

  const cardMix = facts.cardMix || {};
  const cardMixStr = Object.entries(cardMix).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}%`).join(', ') || '-';
  const feeBreakdownStr = Array.isArray(facts.feeBreakdown) && facts.feeBreakdown.length
    ? facts.feeBreakdown.map(f => `${f.label}: ${fmtD(f.amount)}`).join('\n')
    : '-';
  const setupStr = Array.isArray(facts.setup) && facts.setup.length
    ? facts.setup.map(s => `${s.label}: ${s.value}`).join('\n')
    : '-';
  const observationsStr = Array.isArray(facts.observations) && facts.observations.length
    ? facts.observations.map(o => `- ${o}`).join('\n')
    : '-';

  const pitSummary = pit ? JSON.stringify({
    merchantProfile: pit.merchantProfile,
    paymentsStack: pit.paymentsStack,
    commercialIntelligence: pit.commercialIntelligence,
    operationalIntelligence: pit.operationalIntelligence,
    industryIntelligence: pit.industryIntelligence,
    riskIntelligence: pit.riskIntelligence,
    dataQuality: pit.dataQuality,
    commercialReasoning: pit.commercialReasoning,
    caseSummary: pit.caseSummary,
    modulePlan: pit.modulePlan
  }, null, 2) : '-';

  return `Write a personalised Payments Review for this merchant.

Use ONLY:
1. The merchant facts below.
2. The PIT output below.
3. The Knowledge Base supplied in the system prompt.

The PIT has already selected modules, ranked opportunities, assessed risks and formed the commercial reasoning. Your job is to explain those conclusions clearly, professionally and concisely. Do NOT invent modules, providers, products, scores or implementation steps.

STATEMENT FACTS:
Provider: ${facts.provider || '-'}
Period: ${facts.period || '-'}
Card volume: ${fmtD(facts.volume)}
Total fees: ${fmtD(facts.totalFees)}
Effective rate: ${fmtP(facts.effectiveRate ?? m.effectiveRate)}
Transactions: ${facts.transactions || '-'}
Average transaction value: ${fmtD(facts.averageTransactionValue)}
Average fee per transaction: ${fmtD(m.averageFeePerTransaction ?? m.avgFeePerTxn)} - a DOLLAR value, NOT a fixed per-transaction fee
Monthly fee: ${fmtD(facts.monthlyFee)}
Terminal fees: ${fmtD(facts.terminalFees)}
Fixed per-transaction fee (if any): ${facts.perTransactionFee != null ? facts.perTransactionFee + 'c' : '-'}
Pricing model: ${facts.pricingModel || '-'}
Provider rate / margin observed: ${facts.providerRate || '-'}
LCR status observed: ${facts.lcrStatus || '-'}
Card mix: ${cardMixStr}

REFORM SAVINGS ESTIMATE:
${describeReformSavings(m.reformSavings)}

LCR SAVINGS ESTIMATE:
${describeLcrSavings(m.lcrSavings)}

CHARGEBACKS:
${describeChargebacks(facts)}

FEE BREAKDOWN:
${feeBreakdownStr}

CURRENT SETUP:
${setupStr}

FACTUAL OBSERVATIONS FROM THE STATEMENT:
${observationsStr}

SELECTED REPORT MODULES:
${modules.join(', ') || '-'}

RANKED OPPORTUNITIES FROM THE PIT:
${opportunities.map((o, i) => `${i + 1}. ${o.title} | Category: ${o.category || '-'} | Estimated annual value: ${o.estimatedAnnualValue ? fmtD(o.estimatedAnnualValue) : 'Strategic / to be validated'} | Confidence: ${o.confidence || '-'} | Urgency: ${o.urgency || '-'} | Evidence: ${(o.evidence || []).join('; ')}`).join('\n') || '-'}

PIT OUTPUT / CASE INTELLIGENCE:
${pitSummary}

MERCHANT PROFILE / QUESTIONNAIRE CONTEXT:
${programContext || '-'}

${adminNotes ? `ADMIN NOTES (internal context from the acceptorIQ reviewer - use to inform the analysis, but do NOT quote or attribute these in the report):\n${adminNotes}` : ''}`;
}

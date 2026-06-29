// api/_lib/report/narrative/buildUserMessage.js
// Builds the user message sent to Claude. Narrative generation is separate
// from deterministic metrics and opportunity selection.

import { fmtD, fmtP } from '../metrics/formatters.js';

function describeChargebacks(facts) {
  const cb = facts.chargebacks || null;
  if (!cb) return 'Not shown on this statement - this does NOT mean zero chargebacks occurred, only that this data point is not visible here.';
  return [
    cb.count  != null ? `Count: ${cb.count}` : null,
    cb.ratio  != null ? `Ratio: ${cb.ratio.toFixed(2)}% of transactions` : null,
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
    ? `Based on debit card turnover of ${fmtD(lcrSavings.debitTurnover)}, an estimated current debit fee cost of approximately ${fmtD(lcrSavings.estDebitFees)} (debit turnover x this merchant's own blended effective rate, used as a stand-in since debit-specific fees aren't broken out on the statement), and the RBA's ~20% LCR debit-cost reduction estimate: approximately ${fmtD(lcrSavings.monthly)} per month, or approximately ${fmtD(lcrSavings.annual)} per year. This is an ESTIMATE (the underlying debit fee figure is approximated, not read directly off the statement) - say so if you state the figure. Only present this as a live opportunity if LCR status (given above) is not confirmed "On".`
    : 'Not calculable - no usable debit-card-mix percentage and/or effective rate available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';
}

export function buildUserMessage({ report, metrics, selectedModules, priorityOpportunities, programContext, adminNotes }) {
  const facts = report;
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

  return `Write a personalised payments review for this merchant, using ONLY the facts below plus the Knowledge Base for context, benchmarks and interpretation. The facts come from the merchant's own statement; everything interpretive (findings, opinions, narrative, framing) is yours to add.

STATEMENT FACTS:
Provider: ${facts.provider || '-'}
Period: ${facts.period || '-'}
Card volume: ${fmtD(facts.volume)}
Total fees: ${fmtD(facts.totalFees)}
Effective rate: ${fmtP(facts.effectiveRate)}
Transactions: ${facts.transactions || '-'}
Average transaction value: ${fmtD(facts.averageTransactionValue)}
Average fee per transaction (avg sale value x effective rate): ${fmtD(metrics.avgFeePerTxn)} - a DOLLAR value, NOT a fixed per-transaction fee
Monthly fee: ${fmtD(facts.monthlyFee)}
Terminal fees: ${fmtD(facts.terminalFees)}
Fixed per-transaction fee (if any): ${facts.perTransactionFee != null ? facts.perTransactionFee + 'c' : '-'}
Pricing model (verified against the itemised fee breakdown - this is authoritative, not just the statement's own label): ${facts.pricingModel || '-'}
Provider rate / margin (observed): ${facts.providerRate || '-'}
LCR status (observed): ${facts.lcrStatus || '-'}
Card mix: ${cardMixStr}

REFORM SAVINGS ESTIMATE (computed - use this EXACT figure, do not recompute or estimate a different number):
${describeReformSavings(metrics.reformSavings)}

LCR SAVINGS ESTIMATE (computed - use this EXACT figure, do not recompute or estimate a different number):
${describeLcrSavings(metrics.lcrSavings)}

CHARGEBACKS:
${describeChargebacks(facts)}

FEE BREAKDOWN (as printed):
${feeBreakdownStr}

CURRENT SETUP (factual components):
${setupStr}

FACTUAL OBSERVATIONS FROM THE STATEMENT:
${observationsStr}

MODULES SELECTED BY ACCEPTORIQ RULES ENGINE:
${selectedModules.join(', ')}

RANKED OPPORTUNITIES FROM ACCEPTORIQ RULES ENGINE:
${priorityOpportunities.map((o, i) => `${i + 1}. ${o.title} | Category: ${o.category} | Estimated annual value: ${o.estimatedAnnualValue ? fmtD(o.estimatedAnnualValue) : 'Strategic / to be validated'} | Confidence: ${o.confidence} | Urgency: ${o.urgency} | Evidence: ${(o.evidence || []).join('; ')}`).join('\n') || '-'}

MERCHANT PROFILE:
${programContext}${adminNotes ? `\n\nADMIN NOTES (internal context from the acceptorIQ reviewer - use to inform the analysis, but do NOT quote or attribute these in the report):\n${adminNotes}` : ''}`;
}

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
  if (!reformSavings) return 'Not calculable — no usable credit-card-mix percentage available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';

  const confidence = reformSavings.confidence || 'Estimated';
  const isLikely = confidence === 'Likely';
  const rateNote = reformSavings.observedInterchangeRate
    ? `merchant's own observed credit interchange rate (~${reformSavings.observedInterchangeRate.toFixed(2)}%) derived from the IC++ fee breakdown`
    : `RBA-sourced average consumer credit interchange (0.47%)`;

  return `Credit card turnover: ${fmtD(reformSavings.creditTurnover)}.
Calculation basis: ${rateNote} → 0.30% cap from 1 October 2026 (delta: ${reformSavings.capDelta?.toFixed(3) || '0.17'}%).
Result: approximately ${fmtD(reformSavings.monthly)} per month, or approximately ${fmtD(reformSavings.annual)} per year.
Confidence: ${confidence}. ${isLikely ? 'This figure is derived from the merchant\'s own fee data — use it with appropriate precision.' : 'This is a directional estimate using a population average — frame it as approximately or up to.'}
${reformSavings.consumerCardAssumption ? `Important caveat: ${reformSavings.consumerCardAssumption}` : ''}
Use this figure exactly when citing a dollar size for this opportunity. Do not recompute or vary it.`;
}

function describeLcrSavings(lcrSavings) {
  if (!lcrSavings) return 'Not calculable — no usable debit-card-mix percentage and/or effective rate available. Do not state any specific dollar figure for this opportunity anywhere in the report; describe it qualitatively only.';

  const confidence = lcrSavings.confidence || 'Estimated';
  const isLikely = confidence === 'Likely';
  const basisNote = isLikely
    ? `debit proportion of visible interchange fees (${fmtD(lcrSavings.estimatedDebitFees)}) — derived from the IC++ fee breakdown`
    : `estimated debit fees of ${fmtD(lcrSavings.estimatedDebitFees)} (debit turnover × blended effective rate — debit-specific fees not separately visible)`;

  return `Debit card turnover: ${fmtD(lcrSavings.debitTurnover)}.
Calculation basis: ${basisNote} × ${((lcrSavings.lcrReductionRate || 0.20) * 100).toFixed(0)}% LCR reduction (RBA midpoint; range 15–25%).
Result: approximately ${fmtD(lcrSavings.monthly)} per month, or approximately ${fmtD(lcrSavings.annual)} per year.
Confidence: ${confidence}. ${isLikely ? 'This figure uses merchant-specific interchange data.' : 'This is a directional estimate — frame it as approximately or up to.'}
Only present this as a live opportunity if LCR status is not confirmed "On". Use this figure exactly — do not recompute.`;
}

// Serialises commercial observations into readable text for Sonnet.
// Each observation is evidence-backed and has a commercial implication already
// computed by the PIT — Sonnet should use these as the basis for its writing
// rather than re-deriving them from raw facts.
function describeCommercialObservations(observations) {
  if (!Array.isArray(observations) || !observations.length) return '-';
  return observations.map(o =>
    `[${o.id || ''}] ${o.title} (${o.category || 'General'} · ${o.severity || '-'} · ${o.confidence || '-'})
  Observation: ${o.observation || '-'}
  Commercial implication: ${o.commercialImplication || '-'}`
  ).join('\n\n');
}

// Serialises commercial understandings — the PIT's higher-order synthesis.
// These are not raw facts; they are conclusions the PIT has already drawn
// by combining multiple observations. Sonnet should reflect these conclusions
// in the report rather than independently re-reasoning from observations.
function describeCommercialUnderstanding(understandings) {
  if (!Array.isArray(understandings) || !understandings.length) return '-';
  return understandings.map(u =>
    `[${u.id || ''}] ${u.title} (confidence: ${u.confidence || '-'})
  Conclusion: ${u.conclusion || '-'}
  Business impact: ${u.businessImpact || '-'}`
  ).join('\n\n');
}

// Serialises the confidence profile so Sonnet can calibrate its language.
// High confidence areas can be written assertively; Medium/Low areas should
// use conditional language ("appears to", "suggests", "subject to validation").
// Do NOT surface these ratings directly in the report — use them to inform tone.
function describeConfidenceProfile(profile) {
  if (!profile || typeof profile !== 'object') return '-';
  return Object.entries(profile)
    .map(([area, level]) => `${labelise(area)}: ${level}`)
    .join(' · ');
}

// Converts camelCase keys to readable labels for display in the prompt.
function labelise(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// Serialises business priorities — the PIT's ranked action list.
// The rank, rationale, and value are all computed by the PIT's priority engine.
// Sonnet should frame the report around these priorities, not independently
// re-rank the opportunities.
function describeBusinessPriorities(priorities) {
  if (!Array.isArray(priorities) || !priorities.length) return '-';
  return priorities.map(p =>
    `${p.rank || '?'}. ${p.title} | Value: ${p.estimatedAnnualValue ? fmtD(p.estimatedAnnualValue) + '/yr' : 'Strategic'} | Confidence: ${p.confidence || '-'} | Urgency: ${p.urgency || '-'}
  Why this rank: ${p.rankReason || '-'}`
  ).join('\n\n');
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

BUSINESS PRIORITIES (PIT-ranked — use these to determine the report's emphasis and sequencing):
${describeBusinessPriorities(pit?.businessPriorities)}

COMMERCIAL UNDERSTANDING (higher-order conclusions the PIT has already drawn — reflect these in the report, do not re-derive them independently):
${describeCommercialUnderstanding(pit?.commercialUnderstanding)}

COMMERCIAL OBSERVATIONS (evidence-backed observations with commercial implications — use these as the factual basis for the diagnostic sections):
${describeCommercialObservations(pit?.commercialObservations)}

PIT CONFIDENCE PROFILE (use to calibrate language — High = write assertively, Medium = use conditional language, Low = signal data limitation. Do NOT quote these ratings directly in the report):
${describeConfidenceProfile(pit?.confidenceProfile)}

PIT OUTPUT / CASE INTELLIGENCE:
${pitSummary}

MERCHANT PROFILE / QUESTIONNAIRE CONTEXT:
${programContext || '-'}

${adminNotes ? `ADMIN NOTES (internal context from the acceptorIQ reviewer - use to inform the analysis, but do NOT quote or attribute these in the report):\n${adminNotes}` : ''}`;
}

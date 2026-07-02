// api/_lib/pit/calculateMetrics.js
// Metrics Engine: calculates commercial metrics from normalised facts.

import { round } from './utils.js';

export function calculateMetrics(facts) {
  const metrics = {};
  metrics.volume = facts.volume; metrics.totalFees = facts.totalFees; metrics.transactions = facts.transactions;
  metrics.effectiveRate = facts.effectiveRate ?? ((facts.volume && facts.totalFees) ? round(facts.totalFees / facts.volume * 100, 3) : null);
  metrics.averageTransactionValue = facts.averageTransactionValue ?? ((facts.volume && facts.transactions) ? round(facts.volume / facts.transactions, 2) : null);
  metrics.averageFeePerTransaction = (facts.volume && facts.transactions && metrics.effectiveRate) ? round((facts.volume / facts.transactions) * (metrics.effectiveRate / 100), 2) : null;
  metrics.cardMix = { debitPct: facts.cardMix?.debit ?? null, creditPct: facts.cardMix?.credit ?? null, amexPct: facts.cardMix?.amex ?? null, foreignPct: facts.cardMix?.foreign ?? null };
  metrics.cardVolumes = {
    debit: facts.volume && metrics.cardMix.debitPct != null ? round(facts.volume * metrics.cardMix.debitPct / 100, 2) : null,
    credit: facts.volume && metrics.cardMix.creditPct != null ? round(facts.volume * metrics.cardMix.creditPct / 100, 2) : null,
    amex: facts.volume && metrics.cardMix.amexPct != null ? round(facts.volume * metrics.cardMix.amexPct / 100, 2) : null,
    foreign: facts.volume && metrics.cardMix.foreignPct != null ? round(facts.volume * metrics.cardMix.foreignPct / 100, 2) : null,
  };
  metrics.feeComposition = calculateFeeComposition(facts);
  metrics.reformSavings = calculateReformSavings(metrics, facts);
  metrics.lcrSavings = calculateLcrSavings(metrics, facts);
  metrics.benchmarkPosition = calculateBenchmarkPosition(metrics.effectiveRate);
  metrics.dataCompleteness = calculateMetricCompleteness(metrics);
  return metrics;
}

function calculateFeeComposition(facts){ const items=Array.isArray(facts.feeBreakdown)?facts.feeBreakdown:[]; if(!items.length)return null; let interchange=0,scheme=0,margin=0,other=0; for(const item of items){ const label=String(item.label||'').toLowerCase(); const amt=Number(item.amount)||0; if(/interchange/.test(label))interchange+=amt; else if(/scheme/.test(label))scheme+=amt; else if(/margin|merchant service fee|msf|provider|acquirer/.test(label))margin+=amt; else other+=amt;} const total=interchange+scheme+margin+other; if(total<=0)return null; margin+=other; return { interchangeAmount:round(interchange,2), schemeAmount:round(scheme,2), providerMarginAmount:round(margin,2), interchangePct:round(interchange/total*100,1), schemePct:round(scheme/total*100,1), providerMarginPct:round(margin/total*100,1) }; }

// Returns true when the pricing model is IC++ and interchange is a separately
// visible line item in the fee breakdown — which means we have real interchange
// data rather than having to assume population averages.
function hasVisibleInterchange(metrics, facts) {
  const model = (facts.pricingModel || '').toLowerCase();
  const isICPP = /interchange.plus.plus|ic\+\+/.test(model);
  const hasIC = metrics.feeComposition?.interchangeAmount > 0;
  return isICPP && hasIC;
}

// REFORM SAVINGS
// Tiered calculation based on data availability.
//
// Tier 1 — IC++ with visible interchange (confidence: Likely):
//   Derives the merchant's actual credit interchange rate from the fee breakdown,
//   then applies the confirmed cap delta (merchant rate → 0.30%).
//   Uses real data rather than a population average.
//
// Tier 2 — All other pricing models (confidence: Estimated):
//   Falls back to 0.47% as the RBA-sourced average consumer credit interchange.
//   Population average; less precise for merchants above or below this midpoint.
//
// Both tiers assume the reform applies to consumer credit cards only.
// Statements rarely distinguish consumer vs commercial cards, so the saving
// may be overstated if the merchant has significant commercial card volume.
function calculateReformSavings(metrics, facts) {
  const creditTurnover = metrics.cardVolumes?.credit;
  if (!creditTurnover || creditTurnover <= 0) return null;

  if (hasVisibleInterchange(metrics, facts)) {
    // Tier 1: derive merchant's actual interchange rate
    // interchangeAmount covers all cards; approximate credit-card share
    // using the credit mix proportion of total card volume.
    const totalVolume = metrics.volume;
    const creditPct = metrics.cardMix?.creditPct ?? 0;
    const debitPct = metrics.cardMix?.debitPct ?? 0;
    const nonCreditPct = 100 - creditPct;

    // Estimate what portion of interchange is from credit cards
    // by assuming debit interchange is zero (LCR/flat fee) and
    // all IC comes from credit + scheme-eligible cards.
    // Simple approximation: interchangeAmount × (creditPct / 100)
    const totalInterchange = metrics.feeComposition.interchangeAmount;
    const estimatedCreditInterchange = totalVolume && creditPct > 0
      ? totalInterchange * (creditPct / (creditPct + (nonCreditPct * 0.3)))
      : totalInterchange * (creditPct / 100);

    const observedCreditRate = creditTurnover > 0
      ? round(estimatedCreditInterchange / creditTurnover * 100, 3)
      : null;

    // Only proceed if observed rate is above the new cap — otherwise no saving
    if (!observedCreditRate || observedCreditRate <= 0.30) return null;

    // Cap the observed rate at the current regulatory ceiling (0.80%) to
    // avoid overstating for any extraction anomalies
    const effectiveBaseline = Math.min(observedCreditRate, 0.80);
    const delta = effectiveBaseline - 0.30;
    const monthly = round(creditTurnover * (delta / 100), 2);
    if (monthly <= 0) return null;

    return {
      creditTurnover,
      observedInterchangeRate: observedCreditRate,
      capDelta: round(delta, 3),
      monthly,
      annual: round(monthly * 12, 2),
      confidence: 'Likely',
      method: `IC++ merchant: derived credit interchange rate (~${observedCreditRate.toFixed(2)}%) → 0.30% cap delta applied to credit turnover. Consumer card assumption applies.`,
      consumerCardAssumption: 'Statement does not distinguish consumer vs commercial credit cards. Saving may be lower if merchant has significant commercial card volume.'
    };
  }

  // Tier 2: population average fallback
  const AVERAGE_CREDIT_INTERCHANGE = 0.47; // RBA-sourced average consumer credit interchange
  const CAP = 0.30;                          // New cap from 1 October 2026
  const monthly = round(creditTurnover * ((AVERAGE_CREDIT_INTERCHANGE - CAP) / 100), 2);
  if (monthly <= 0) return null;

  return {
    creditTurnover,
    observedInterchangeRate: null,
    capDelta: round(AVERAGE_CREDIT_INTERCHANGE - CAP, 3),
    monthly,
    annual: round(monthly * 12, 2),
    confidence: 'Estimated',
    method: `Population average: ${AVERAGE_CREDIT_INTERCHANGE}% average consumer credit interchange → 0.30% cap delta applied to credit turnover. Merchant-specific rate not visible from statement.`,
    consumerCardAssumption: 'Statement does not distinguish consumer vs commercial credit cards. Saving may be lower if merchant has significant commercial card volume.'
  };
}

// LCR SAVINGS
// Tiered calculation based on data availability.
//
// Returns null immediately if LCR is already confirmed On — there is no
// further saving to capture if routing is already active.
//
// Tier 1 — IC++ with visible interchange (confidence: Likely):
//   Uses the visible interchange amount × debit proportion as the basis,
//   which is more accurate than the blended effective rate proxy.
//   Debit interchange under LCR routes to the cheapest eligible network,
//   typically reducing the debit interchange component by 15–25%.
//
// Tier 2 — All other cases (confidence: Estimated):
//   Keeps the original approach: debit turnover × blended effective rate × 20%.
//   Less precise but defensible as a directional estimate.
function calculateLcrSavings(metrics, facts) {
  const debitTurnover = metrics.cardVolumes?.debit;
  if (!debitTurnover || debitTurnover <= 0) return null;

  // No saving if LCR is already active
  const lcrStatus = (facts.lcrStatus || '').toLowerCase();
  if (/^(on|enabled|active|yes)$/.test(lcrStatus)) return null;

  const LCR_REDUCTION = 0.20; // RBA midpoint estimate; range is ~15–25%

  if (hasVisibleInterchange(metrics, facts)) {
    // Tier 1: use the debit proportion of visible interchange as the cost basis.
    // LCR primarily reduces debit interchange (routes to cheapest network),
    // so this is the directly relevant cost line.
    const totalVolume = metrics.volume;
    const debitPct = metrics.cardMix?.debitPct ?? 0;
    const totalInterchange = metrics.feeComposition.interchangeAmount;

    // Approximate debit's share of interchange
    // (debit typically has lower IC than credit, so this may overstate slightly,
    //  but without DNDC/SNDC split from the statement it's the best available proxy)
    const estimatedDebitInterchange = debitPct > 0
      ? round(totalInterchange * (debitPct / 100), 2)
      : null;

    if (!estimatedDebitInterchange || estimatedDebitInterchange <= 0) {
      // Fall through to Tier 2 if debit interchange estimate is unusable
    } else {
      const monthly = round(estimatedDebitInterchange * LCR_REDUCTION, 2);
      if (monthly <= 0) return null;
      return {
        debitTurnover,
        estimatedDebitFees: estimatedDebitInterchange,
        lcrReductionRate: LCR_REDUCTION,
        monthly,
        annual: round(monthly * 12, 2),
        confidence: 'Likely',
        method: `IC++ merchant: debit proportion (~${debitPct}%) of visible interchange ($${estimatedDebitInterchange}) × ${LCR_REDUCTION * 100}% LCR reduction (RBA midpoint). Range: 15–25%.`,
      };
    }
  }

  // Tier 2: blended effective rate proxy (original approach)
  if (!metrics.effectiveRate) return null;
  const estDebitFees = round(debitTurnover * (metrics.effectiveRate / 100), 2);
  const monthly = round(estDebitFees * LCR_REDUCTION, 2);
  if (monthly <= 0) return null;

  return {
    debitTurnover,
    estimatedDebitFees: estDebitFees,
    lcrReductionRate: LCR_REDUCTION,
    monthly,
    annual: round(monthly * 12, 2),
    confidence: 'Estimated',
    method: `Debit turnover × blended effective rate (${metrics.effectiveRate}%) × ${LCR_REDUCTION * 100}% LCR reduction. Blended rate overstates debit cost; merchant-specific debit fees not visible. Range: 15–25%.`,
  };
}

function calculateBenchmarkPosition(effectiveRate){ if(effectiveRate==null)return null; const refs={smallBlended:1.4,smallUnblended:0.9,largeStrategic:0.6}; let position='Unknown'; if(effectiveRate<=0.6)position='At or below large-merchant benchmark'; else if(effectiveRate<=0.9)position='Below typical small unblended benchmark'; else if(effectiveRate<=1.4)position='Below typical small blended benchmark'; else position='Above typical small blended benchmark'; return {effectiveRate,refs,position}; }
function calculateMetricCompleteness(metrics){ const required=[metrics.volume,metrics.totalFees,metrics.effectiveRate,metrics.transactions,metrics.cardMix.debitPct,metrics.cardMix.creditPct,metrics.feeComposition]; const present=required.filter(v=>v!==null&&v!==undefined).length; return {present,total:required.length,level:present>=6?'High':present>=4?'Medium':'Low'}; }

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
  metrics.reformSavings = calculateReformSavings(metrics);
  metrics.lcrSavings = calculateLcrSavings(metrics);
  metrics.benchmarkPosition = calculateBenchmarkPosition(metrics.effectiveRate);
  metrics.dataCompleteness = calculateMetricCompleteness(metrics);
  return metrics;
}
function calculateFeeComposition(facts){ const items=Array.isArray(facts.feeBreakdown)?facts.feeBreakdown:[]; if(!items.length)return null; let interchange=0,scheme=0,margin=0,other=0; for(const item of items){ const label=String(item.label||'').toLowerCase(); const amt=Number(item.amount)||0; if(/interchange/.test(label))interchange+=amt; else if(/scheme/.test(label))scheme+=amt; else if(/margin|merchant service fee|msf|provider|acquirer/.test(label))margin+=amt; else other+=amt;} const total=interchange+scheme+margin+other; if(total<=0)return null; margin+=other; return { interchangeAmount:round(interchange,2), schemeAmount:round(scheme,2), providerMarginAmount:round(margin,2), interchangePct:round(interchange/total*100,1), schemePct:round(scheme/total*100,1), providerMarginPct:round(margin/total*100,1) }; }
function calculateReformSavings(metrics){ const creditTurnover=metrics.cardVolumes.credit; if(!creditTurnover||creditTurnover<=0)return null; const monthly=creditTurnover*((0.47-0.30)/100); return monthly>0?{creditTurnover,monthly:round(monthly,2),annual:round(monthly*12,2),confidence:'Estimated',method:'credit turnover x average-to-cap consumer credit interchange delta'}:null; }
function calculateLcrSavings(metrics){ const debitTurnover=metrics.cardVolumes.debit; if(!debitTurnover||!metrics.effectiveRate)return null; const estDebitFees=debitTurnover*(metrics.effectiveRate/100); const monthly=estDebitFees*0.20; return {debitTurnover:round(debitTurnover,2),estimatedDebitFees:round(estDebitFees,2),monthly:round(monthly,2),annual:round(monthly*12,2),confidence:'Estimated',method:'debit turnover x blended effective rate x 20% LCR reduction estimate'}; }
function calculateBenchmarkPosition(effectiveRate){ if(effectiveRate==null)return null; const refs={smallBlended:1.4,smallUnblended:0.9,largeStrategic:0.6}; let position='Unknown'; if(effectiveRate<=0.6)position='At or below large-merchant benchmark'; else if(effectiveRate<=0.9)position='Below typical small unblended benchmark'; else if(effectiveRate<=1.4)position='Below typical small blended benchmark'; else position='Above typical small blended benchmark'; return {effectiveRate,refs,position}; }
function calculateMetricCompleteness(metrics){ const required=[metrics.volume,metrics.totalFees,metrics.effectiveRate,metrics.transactions,metrics.cardMix.debitPct,metrics.cardMix.creditPct,metrics.feeComposition]; const present=required.filter(v=>v!==null&&v!==undefined).length; return {present,total:required.length,level:present>=6?'High':present>=4?'Medium':'Low'}; }

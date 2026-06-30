// api/_lib/pit/buildCaseSummary.js
// Case Intelligence: synthesises the PIT output into a reusable case summary.

export function buildCaseSummary({ merchantProfile, paymentsStack, metrics, findings, opportunities, risks, dataQuality, commercialReasoning }) {
  const topOpps=(opportunities||[]).slice(0,4);
  const totalQuantifiedAnnual=topOpps.reduce((sum,o)=>sum+(Number(o.estimatedAnnualValue)||0),0);
  return { merchantName:merchantProfile.name, headline:commercialReasoning.primaryCommercialTheme, summary:commercialReasoning.whyItMatters, currentPosition:{ provider:paymentsStack.acquirerOrProvider, pricingModel:paymentsStack.pricingModel, effectiveRate:metrics.effectiveRate, volume:metrics.volume, totalFees:metrics.totalFees, debitMix:metrics.cardMix?.debitPct, creditMix:metrics.cardMix?.creditPct }, quantifiedAnnualOpportunity:totalQuantifiedAnnual||null, topOpportunities:topOpps.map(o=>({id:o.id,title:o.title,estimatedAnnualValue:o.estimatedAnnualValue||null,confidence:o.confidence,urgency:o.urgency,valueBand:o.valueBand})), keyFindings:(findings||[]).slice(0,5).map(f=>({id:f.id,title:f.title,confidence:f.confidence})), keyRisks:(risks||[]).slice(0,4).map(r=>({id:r.id,type:r.type,severity:r.severity})), dataQuality:{level:dataQuality.qualityLevel,gaps:(dataQuality.gaps||[]).slice(0,5)} };
}

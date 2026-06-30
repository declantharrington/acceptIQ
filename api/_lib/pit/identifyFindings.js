// api/_lib/pit/identifyFindings.js
// Findings Engine: turns intelligence into evidence-based observations.

export function identifyFindings({ facts, metrics, commercialIntelligence, industryIntelligence, riskIntelligence }) {
  const findings=[];
  if(commercialIntelligence.pricingModel?.model && commercialIntelligence.pricingModel.model!=='Unknown')findings.push({id:'pricing-model',category:'Commercial',title:`Pricing model identified: ${commercialIntelligence.pricingModel.model}`,observation:commercialIntelligence.pricingModel.interpretation,confidence:'Confirmed',evidence:[`Pricing model: ${commercialIntelligence.pricingModel.model}`]});
  if(commercialIntelligence.providerMargin?.position)findings.push({id:'provider-margin',category:'Commercial',title:`Provider margin ${commercialIntelligence.providerMargin.position.toLowerCase()}`,observation:commercialIntelligence.providerMargin.observed?`Provider margin observed as ${commercialIntelligence.providerMargin.observed}.`:'Provider margin is not clearly visible.',confidence:commercialIntelligence.providerMargin.observed?'Confirmed':'Needs validation',evidence:commercialIntelligence.providerMargin.observed?[`Provider margin: ${commercialIntelligence.providerMargin.observed}`]:[]});
  if(metrics.cardMix?.debitPct>0)findings.push({id:'debit-mix',category:'Routing',title:`Debit represents ${metrics.cardMix.debitPct}% of visible card volume`,observation:'Debit mix is commercially relevant because routing can materially change debit acceptance cost.',confidence:'Confirmed',evidence:[`Debit mix: ${metrics.cardMix.debitPct}%`]});
  if(facts.lcrStatus==='Unknown')findings.push({id:'lcr-unknown',category:'Routing',title:'Least-cost routing status is not confirmed',observation:'The statement does not confirm whether debit is being routed through the lowest-cost available network.',confidence:'Needs validation',evidence:['LCR status: Unknown']});
  for(const reform of industryIntelligence.relevantReforms||[])findings.push({id:reform.id,category:'Industry / regulatory',title:reform.title,observation:reform.implication,confidence:reform.confidence,evidence:[reform.relevance,`Date: ${reform.date}`]});
  for(const risk of riskIntelligence.risks||[])findings.push({id:risk.id,category:'Risk',title:risk.type,observation:risk.observation,confidence:risk.confidence,evidence:[risk.implication]});
  return findings;
}

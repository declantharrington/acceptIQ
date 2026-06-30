// api/_lib/pit/commercialIntelligence.js
// Commercial Intelligence: analyses pricing, margins, cost drivers and commercial positioning.

import { lower } from './utils.js';

export function buildCommercialIntelligence({ facts, metrics, paymentsStack }) {
  const intelligence = { pricingModel: analysePricingModel(facts), providerMargin: analyseProviderMargin(facts), costDrivers: analyseCostDrivers(metrics), benchmark: metrics.benchmarkPosition, commercialRead: [], commercialQuestions: [] };
  if (intelligence.pricingModel.transparency === 'High') intelligence.commercialRead.push('Pricing structure appears transparent, which improves the ability to validate pass-through and isolate provider margin.');
  if (intelligence.providerMargin.position === 'Competitive') intelligence.commercialRead.push('Provider margin appears commercially lean based on the observed margin.');
  else if (intelligence.providerMargin.position === 'Needs validation') intelligence.commercialQuestions.push('Validate the provider margin and any fees billed outside the merchant statement.');
  if (metrics.feeComposition?.interchangePct >= 50) intelligence.commercialRead.push('Interchange is the largest cost driver, making reform pass-through and card mix especially important.');
  if (paymentsStack.missingComponents?.includes('Gateway fee invoice / gateway reporting')) intelligence.commercialQuestions.push('Confirm gateway fees to calculate true total cost of acceptance.');
  return intelligence;
}
function analysePricingModel(facts){ const model=facts.pricingModel||'Unknown'; const l=lower(model); let transparency='Unknown'; if(/interchange-plus-plus|ic\+\+/.test(l))transparency='High'; else if(/interchange-plus|ic\+/.test(l))transparency='Medium-high'; else if(/blended|single|flat/.test(l))transparency='Low-medium'; return {model,transparency,interpretation:transparency==='High'?'The statement separates wholesale and provider-controlled cost layers.':'The statement may not fully separate wholesale cost and provider margin.'}; }
function analyseProviderMargin(facts){ const raw=facts.providerRate||''; const n=Number(String(raw).replace(/[^\d.]/g,'')); if(!raw)return{observed:null,position:'Needs validation'}; if(Number.isFinite(n)&&n<=0.15)return{observed:raw,position:'Competitive'}; if(Number.isFinite(n)&&n<=0.30)return{observed:raw,position:'Moderate'}; return{observed:raw,position:'Needs review'}; }
function analyseCostDrivers(metrics){ const fc=metrics.feeComposition; if(!fc)return[]; return [{id:'interchange',label:'Interchange',pct:fc.interchangePct,amount:fc.interchangeAmount},{id:'scheme',label:'Scheme fees',pct:fc.schemePct,amount:fc.schemeAmount},{id:'provider-margin',label:'Provider margin and other',pct:fc.providerMarginPct,amount:fc.providerMarginAmount}].sort((a,b)=>(b.pct||0)-(a.pct||0)); }

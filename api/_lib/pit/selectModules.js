// api/_lib/pit/selectModules.js
// Module Selector: chooses report modules and assigns importance.

export function selectModules({ metrics, opportunities, riskIntelligence, dataQuality }) {
  const modules=[{id:'landscape',type:'foundation',priority:'major',reason:'Always sets market context.'},{id:'key-takeaways',type:'foundation',priority:'major',reason:'Always summarises the key observations.'},{id:'snapshot',type:'foundation',priority:'major',reason:'Always establishes the facts.'},{id:'fee-analysis',type:'foundation',priority:metrics.feeComposition?'major':'supporting',reason:'Shows what the merchant is paying.'}];
  for(const opp of opportunities||[]){ const id=moduleIdForOpportunity(opp); if(!id||modules.some(m=>m.id===id))continue; modules.push({id,type:'diagnostic',priority:classifyPriority(opp),reason:opp.title,opportunityId:opp.id,confidence:opp.confidence}); }
  if(!modules.some(m=>m.id==='benchmark'))modules.push({id:'benchmark',type:'diagnostic',priority:'supporting',reason:'Benchmarking provides market position.'});
  if(riskIntelligence.risks?.length||dataQuality.gaps?.length)modules.push({id:'data-gaps-risk',type:'diagnostic',priority:'minor',reason:'Data gaps and risks should be captured compactly.'});
  modules.push({id:'opportunity-summary',type:'summary',priority:'major',reason:'Always summarises opportunity value and validation priorities.'});
  modules.push({id:'next-steps',type:'cta',priority:'major',reason:'Always closes with engagement path.'});
  return modules;
}
function classifyPriority(opp){ if(Number(opp.estimatedAnnualValue)>=10000||opp.urgency==='High')return'major'; if(opp.confidence==='Confirmed'||opp.confidence==='Likely')return'supporting'; return'minor'; }
function moduleIdForOpportunity(opp){ return {pricing:'pricing',reform:'reform',lcr:'lcr',surcharge:'surcharge',chargebacks:'chargebacks',stack:'stack'}[opp.module] || opp.module; }

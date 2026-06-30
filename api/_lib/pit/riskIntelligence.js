// api/_lib/pit/riskIntelligence.js
// Risk Intelligence: identifies commercial, compliance, operational and data risks.

export function buildRiskIntelligence({ facts, merchantProfile, paymentsStack, metrics }) {
  const risks=[];
  if(paymentsStack.surchargeStatus!=='Not indicated')risks.push({id:'surcharge-reform-risk',type:'Compliance / margin planning',severity:'High',confidence:'Needs validation',observation:'Surcharging appears relevant and rules change from 1 October 2026.',implication:'Margin and pricing strategy may need to change before the reform date.'});
  if(paymentsStack.missingComponents?.includes('Gateway fee invoice / gateway reporting'))risks.push({id:'incomplete-cost-risk',type:'Commercial',severity:'Medium',confidence:'Likely',observation:'Gateway costs are not visible in the current statement.',implication:'The calculated effective rate may not reflect the full cost of acceptance.'});
  if(!facts.chargebacks && /online|card-not-present|cnp|omnichannel/i.test([merchantProfile.businessModel,merchantProfile.channelProfile].join(' ')))risks.push({id:'chargeback-visibility-risk',type:'Operational',severity:'Medium',confidence:'Needs validation',observation:'Chargeback data is not visible despite online/card-not-present relevance.',implication:'Dispute risk cannot be assessed from this statement alone.'});
  if(metrics.dataCompleteness?.level==='Low')risks.push({id:'data-quality-risk',type:'Data quality',severity:'Medium',confidence:'Confirmed',observation:'Several core data points are missing.',implication:'The PIT can identify directional opportunities but cannot fully quantify all areas.'});
  return { risks, riskProfile: risks.some(r=>r.severity==='High')?'Action required':risks.length?'Some validation required':'No major risks visible from current data' };
}

// api/_lib/pit/dataQuality.js
// Data Quality Intelligence: describes confidence, missing inputs and quality constraints.

export function assessDataQuality({ facts, paymentsStack, operationalIntelligence }) {
  const gaps=[]; const add=(id,label,severity,reason,requestedData)=>gaps.push({id,label,severity,reason,requestedData});
  if(!facts.volume)add('missing-volume','Card volume missing','High','Card volume is required for most metrics.','Merchant statement with total turnover.');
  if(!facts.totalFees)add('missing-fees','Total fees missing','High','Total fees are required to calculate effective rate.','Statement page showing total merchant fees.');
  if(!facts.feeBreakdown?.length)add('missing-fee-breakdown','Fee breakdown missing','Medium','Fee composition cannot be decomposed.','Detailed fee component page.');
  if(!facts.cardMix?.debit&&!facts.cardMix?.credit)add('missing-card-mix','Card mix missing','Medium','Routing and reform calculations require debit/credit split.','Interchange or scheme fee breakdown by card category.');
  if(!facts.lcrStatus||facts.lcrStatus==='Unknown')add('missing-lcr-status','LCR status unknown','Medium','Debit routing cannot be confirmed.','Provider confirmation of routing configuration.');
  if(!facts.chargebacks)add('missing-chargebacks','Chargeback data not shown','Low','Dispute performance cannot be assessed.','Chargeback/dispute report.');
  for(const g of operationalIntelligence.operationalGaps||[])if(!gaps.some(x=>x.id===g.id))add(g.id,g.missingData,g.severity,g.implication,g.requestedData);
  const high=gaps.filter(g=>g.severity==='High').length, medium=gaps.filter(g=>g.severity==='Medium').length;
  return { qualityLevel: high?'Low':medium>=2?'Medium':'High', gaps, confidenceByArea:{ merchantProfile:facts.context?.company?'High':'Medium', pricing:facts.pricingModel?'High':'Medium', fees:facts.feeBreakdown?.length?'High':'Medium', routing:facts.lcrStatus&&facts.lcrStatus!=='Unknown'?'High':'Low', chargebacks:facts.chargebacks?'High':'Low', gateway:paymentsStack.gateway?'Medium':'Low' } };
}

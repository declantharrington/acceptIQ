// api/_lib/pit/operationalIntelligence.js
// Operational Intelligence: assesses operational visibility, performance and payments operations.

export function buildOperationalIntelligence({ facts, merchantProfile, paymentsStack }) {
  const items = [], gaps = [];
  if (facts.chargebacks) items.push({ id:'chargebacks-visible', area:'Chargebacks', status:'Visible', confidence:'Confirmed', observation:'Chargeback data is visible in the statement.' });
  else gaps.push({ id:'chargeback-data-gap', area:'Chargebacks', severity:isOnline(merchantProfile)?'Medium':'Low', missingData:'Chargeback and dispute reporting', implication:'Dispute risk and refund/chargeback performance cannot be fully assessed from this statement alone.', requestedData:'Gateway/acquirer chargeback report or dispute export.' });
  if (paymentsStack.gateway) items.push({ id:'gateway-indicated', area:'Gateway', status:'Indicated', confidence:'Likely', observation:'Gateway or online acceptance appears relevant.' });
  else if (isOnline(merchantProfile)) gaps.push({ id:'gateway-cost-gap', area:'Gateway', severity:'Medium', missingData:'Gateway invoice or gateway transaction report', implication:'Total cost of acceptance may be understated if gateway fees are billed separately.', requestedData:'Gateway invoice, gateway fee schedule, or transaction export.' });
  if (!facts.lcrStatus || facts.lcrStatus === 'Unknown') gaps.push({ id:'routing-configuration-gap', area:'Routing', severity:'High', missingData:'Debit routing configuration', implication:'Debit savings cannot be confirmed without knowing whether LCR is active across card-present, online and wallet channels.', requestedData:'Provider confirmation of LCR status by channel.' });
  return { operationalItems: items, operationalGaps: gaps, operationalReadiness: gaps.some(g=>g.severity==='High') ? 'Needs validation' : 'Reasonable' };
}
function isOnline(profile){ return /online|card-not-present|cnp|omnichannel/i.test([profile.businessModel,profile.channelProfile].join(' ')); }

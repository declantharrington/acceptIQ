// api/_lib/pit/dataQuality.js
// Flags missing or incomplete inputs so the admin/report can treat unknowns honestly.

export function identifyDataGaps({ facts, paymentsStack }) {
  const gaps = [];
  if (!facts.provider) gaps.push(gap('provider', 'Provider not identified', 'Needs validation'));
  if (!facts.volume || !facts.totalFees) gaps.push(gap('core-fees', 'Volume or total fees missing', 'High'));
  if (!facts.pricingModel || facts.pricingModel === 'Unknown') gaps.push(gap('pricing-model', 'Pricing model not clearly identified', 'Medium'));
  if (facts.cardMix?.debit == null && facts.cardMix?.credit == null) gaps.push(gap('card-mix', 'Debit/credit card mix not available', 'Medium'));
  if (!facts.lcrStatus || facts.lcrStatus === 'Unknown') gaps.push(gap('lcr-status', 'LCR status not confirmed', 'Medium'));
  if (!facts.chargebacks) gaps.push(gap('chargebacks', 'Chargeback data not visible on the statement', 'Low'));
  if (paymentsStack.gatewayDetected && !paymentsStack.sourceCoverage.gatewayInvoice) gaps.push(gap('gateway-fees', 'Gateway fees may sit on a separate invoice', 'Medium'));
  return gaps;
}

function gap(id, title, priority) {
  return { id, title, priority };
}

// api/_lib/pit/identifyOpportunities.js
// Converts PIT metrics/findings into commercial opportunities. No arbitrary
// 0-100 scoring is used; ranking is based on annual value, urgency and confidence.

import { lower } from './utils.js';

export function moneyBand(value) {
  const n = Number(value) || 0;
  if (n >= 50000) return 'High';
  if (n >= 10000) return 'Medium';
  if (n > 0) return 'Low';
  return 'Strategic';
}

export function identifyOpportunities({ facts, metrics, merchantProfile, paymentsStack, findings }) {
  const opportunities = [];
  const lcrStatus = lower(facts.lcrStatus);
  const debitPct = facts.cardMix?.debit != null ? Number(facts.cardMix.debit) : null;
  const creditPct = facts.cardMix?.credit != null ? Number(facts.cardMix.credit) : null;
  const hasDebit = debitPct != null && !Number.isNaN(debitPct) && debitPct > 0;
  const hasCredit = creditPct != null && !Number.isNaN(creditPct) && creditPct > 0;
  const lcrConfirmedOn = ['on', 'enabled', 'active', 'yes'].includes(lcrStatus);
  const lcrUnavailable = ['not applicable', 'n/a', 'na'].includes(lcrStatus);

  if (metrics.reformSavings && hasCredit) {
    opportunities.push({
      id: 'october-reform',
      title: 'October 2026 interchange reform',
      category: 'Regulatory change',
      estimatedAnnualValue: metrics.reformSavings.annual,
      valueBand: moneyBand(metrics.reformSavings.annual),
      confidence: 'Estimated',
      urgency: 'High',
      evidence: ['Credit card turnover detected', 'Consumer credit interchange cap changes from 1 October 2026'],
      module: 'reform'
    });
  }

  if (hasDebit && !lcrConfirmedOn && !lcrUnavailable && metrics.lcrSavings) {
    opportunities.push({
      id: 'least-cost-routing',
      title: 'Debit routing / least-cost routing',
      category: 'Cost reduction',
      estimatedAnnualValue: metrics.lcrSavings.annual,
      valueBand: moneyBand(metrics.lcrSavings.annual),
      confidence: lcrStatus === 'off' ? 'Likely' : 'Needs validation',
      urgency: 'Medium',
      evidence: [`${debitPct.toFixed(1)}% debit mix`, `LCR status observed as ${facts.lcrStatus || 'unknown'}`],
      module: 'lcr'
    });
  }

  const surchargeObs = [facts.surchargeDetected, facts.surcharging, ...(facts.observations || []), merchantProfile.rawProgramContext || ''].filter(Boolean).join(' ').toLowerCase();
  if (/surcharge|surcharging|card surcharge/.test(surchargeObs)) {
    opportunities.push({
      id: 'surcharge-reform',
      title: 'Surcharge strategy before October 2026',
      category: 'Regulatory / margin planning',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: facts.surchargeDetected ? 'Confirmed' : 'Needs validation',
      urgency: 'High',
      evidence: ['Surcharging appears relevant from the submission or observations'],
      module: 'surcharge'
    });
  }

  if (facts.pricingModel || facts.providerRate || Array.isArray(facts.feeBreakdown)) {
    opportunities.push({
      id: 'pricing-structure',
      title: 'Pricing structure and provider margin',
      category: 'Commercial review',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: facts.providerRate ? 'Confirmed' : 'Needs validation',
      urgency: 'Medium',
      evidence: [facts.pricingModel ? `Pricing model: ${facts.pricingModel}` : 'Pricing model not clearly stated'],
      module: 'pricing'
    });
  }

  if (facts.chargebacks) {
    opportunities.push({
      id: 'chargebacks',
      title: 'Chargeback visibility and risk',
      category: 'Risk management',
      estimatedAnnualValue: facts.chargebacks.fees ? Number(facts.chargebacks.fees) * 12 : null,
      valueBand: facts.chargebacks.fees ? moneyBand(Number(facts.chargebacks.fees) * 12) : 'Strategic',
      confidence: 'Confirmed',
      urgency: facts.chargebacks.ratio && facts.chargebacks.ratio > 0.65 ? 'High' : 'Medium',
      evidence: ['Chargeback data is visible in the statement'],
      module: 'chargebacks'
    });
  } else if (paymentsStack.gatewayDetected || /online|cnp|ecommerce/i.test(merchantProfile.channel || '')) {
    opportunities.push({
      id: 'chargeback-visibility',
      title: 'Chargeback visibility',
      category: 'Data completeness',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: 'Needs validation',
      urgency: 'Low',
      evidence: ['Chargeback data is not visible on the statement'],
      module: 'chargebacks'
    });
  }

  if (paymentsStack.gatewayDetected && !paymentsStack.sourceCoverage.gatewayInvoice) {
    opportunities.push({
      id: 'gateway-cost-visibility',
      title: 'Gateway cost visibility',
      category: 'Data completeness',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: 'Needs validation',
      urgency: 'Medium',
      evidence: ['Gateway appears present but gateway invoice/fees are not visible in the statement'],
      module: 'stack'
    });
  }

  return opportunities.sort(compareOpportunities);
}

export function compareOpportunities(a, b) {
  const urgency = { High: 3, Medium: 2, Low: 1 };
  const confidence = { Confirmed: 3, Likely: 2.5, Estimated: 2, 'Needs validation': 1 };
  const valueA = Number(a.estimatedAnnualValue) || 0;
  const valueB = Number(b.estimatedAnnualValue) || 0;
  if (valueA !== valueB) return valueB - valueA;
  if ((urgency[a.urgency] || 0) !== (urgency[b.urgency] || 0)) return (urgency[b.urgency] || 0) - (urgency[a.urgency] || 0);
  return (confidence[b.confidence] || 0) - (confidence[a.confidence] || 0);
}

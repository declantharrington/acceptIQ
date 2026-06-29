// api/_lib/pit/identifyFindings.js
// Produces structured observations from facts and metrics. Findings are not yet
// recommendations; they are the evidence-backed statements the modules can use.

import { lower } from './utils.js';

export function identifyFindings({ facts, metrics, paymentsStack, merchantProfile }) {
  const findings = [];

  if (facts.effectiveRate != null) {
    const rate = Number(facts.effectiveRate);
    findings.push({
      id: 'effective-rate',
      category: 'Cost position',
      title: 'Effective rate calculated',
      body: `All-in card acceptance cost is ${rate.toFixed(2)}% of turnover.`,
      confidence: 'Confirmed',
      evidence: ['volume', 'totalFees'],
      severity: rate > 1.4 ? 'warn' : rate <= 0.7 ? 'good' : 'info'
    });
  }

  if (facts.pricingModel || facts.providerRate) {
    findings.push({
      id: 'pricing-model',
      category: 'Pricing',
      title: 'Pricing structure visible',
      body: `${facts.pricingModel || 'Pricing model'}${facts.providerRate ? ` with provider margin/rate ${facts.providerRate}` : ''}.`,
      confidence: facts.pricingModel ? 'Confirmed' : 'Needs validation',
      evidence: ['pricingModel', 'providerRate', 'feeBreakdown'],
      severity: /interchange-plus/i.test(facts.pricingModel || '') ? 'good' : 'info'
    });
  }

  if (metrics.feeComposition) {
    const largest = largestFeeBucket(metrics.feeComposition);
    findings.push({
      id: 'fee-composition',
      category: 'Cost anatomy',
      title: 'Fee composition available',
      body: `${largest.label} is the largest visible cost layer at ${largest.percent.toFixed(1)}% of fees.`,
      confidence: 'Confirmed',
      evidence: ['feeBreakdown'],
      severity: 'info'
    });
  }

  const lcrStatus = lower(facts.lcrStatus);
  const debitPct = facts.cardMix?.debit;
  if (debitPct != null && debitPct > 0) {
    findings.push({
      id: 'debit-routing',
      category: 'Debit routing',
      title: 'Debit volume present',
      body: `${Number(debitPct).toFixed(1)}% of turnover appears to be debit. LCR status is ${facts.lcrStatus || 'unknown'}.`,
      confidence: ['on', 'off', 'partial'].includes(lcrStatus) ? 'Confirmed' : 'Needs validation',
      evidence: ['cardMix.debit', 'lcrStatus'],
      severity: ['off', 'unknown', 'partial', ''].includes(lcrStatus) ? 'warn' : 'good'
    });
  }

  if (metrics.reformSavings) {
    findings.push({
      id: 'october-reform-exposure',
      category: 'Regulatory reform',
      title: 'Consumer credit reform exposure',
      body: 'Credit card turnover creates exposure to the October 2026 consumer credit interchange reform.',
      confidence: 'Estimated',
      evidence: ['cardMix.credit', 'volume'],
      severity: 'warn'
    });
  }

  const surchargeText = [facts.surchargeDetected, facts.surcharging, ...(facts.observations || []), merchantProfile.rawProgramContext || ''].filter(Boolean).join(' ');
  if (/surcharge|surcharging|card surcharge/i.test(surchargeText)) {
    findings.push({
      id: 'surcharge-detected',
      category: 'Surcharging',
      title: 'Surcharging appears relevant',
      body: 'Surcharging is visible or referenced and may need to be considered ahead of October 2026 rule changes.',
      confidence: facts.surchargeDetected ? 'Confirmed' : 'Needs validation',
      evidence: ['observations', 'questionnaire'],
      severity: 'warn'
    });
  }

  if (facts.chargebacks) {
    findings.push({
      id: 'chargebacks-visible',
      category: 'Risk',
      title: 'Chargeback data visible',
      body: `Chargeback data is visible${facts.chargebacks.ratio != null ? ` with a ratio of ${Number(facts.chargebacks.ratio).toFixed(2)}%` : ''}.`,
      confidence: 'Confirmed',
      evidence: ['chargebacks'],
      severity: facts.chargebacks.ratio != null && facts.chargebacks.ratio >= 0.65 ? 'warn' : 'info'
    });
  } else if (paymentsStack.gatewayDetected || /online|cnp|ecommerce/i.test(merchantProfile.channel || '')) {
    findings.push({
      id: 'chargebacks-not-visible',
      category: 'Data completeness',
      title: 'Chargeback data not visible',
      body: 'Chargeback data is not visible in the statement provided.',
      confidence: 'Confirmed',
      evidence: ['statement absence'],
      severity: 'info'
    });
  }

  return findings;
}

function largestFeeBucket(comp) {
  const buckets = [
    { label: 'Interchange', percent: comp.interchangePct || 0 },
    { label: 'Scheme fees', percent: comp.schemePct || 0 },
    { label: 'Provider margin and other fees', percent: comp.marginPct || 0 },
  ];
  return buckets.sort((a, b) => b.percent - a.percent)[0];
}

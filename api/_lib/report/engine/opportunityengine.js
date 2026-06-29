// api/_lib/report/engine/opportunityEngine.js
// Determines which report modules should be included and ranks opportunities.
// No arbitrary 0-100 scores are used. Priority is based on defensible factors:
// value band, confidence, urgency and relevance.

const lower = v => String(v || '').trim().toLowerCase();

export function moneyBand(value) {
  const n = Number(value) || 0;
  if (n >= 50000) return 'High';
  if (n >= 10000) return 'Medium';
  if (n > 0) return 'Low';
  return 'Strategic';
}

export function buildOpportunities({ report, reformSavings, lcrSavings }) {
  const opportunities = [];
  const lcrStatus = lower(report.lcrStatus);
  const debitPct = report.cardMix?.debit != null ? Number(report.cardMix.debit) : null;
  const creditPct = report.cardMix?.credit != null ? Number(report.cardMix.credit) : null;
  const hasDebit = debitPct != null && !Number.isNaN(debitPct) && debitPct > 0;
  const hasCredit = creditPct != null && !Number.isNaN(creditPct) && creditPct > 0;
  const lcrConfirmedOn = ['on', 'enabled', 'active', 'yes'].includes(lcrStatus);
  const lcrUnavailable = ['not applicable', 'n/a', 'na'].includes(lcrStatus);

  if (reformSavings && hasCredit) {
    opportunities.push({
      id: 'october-reform',
      title: 'October 2026 interchange reform',
      category: 'Regulatory change',
      estimatedAnnualValue: reformSavings.annual,
      valueBand: moneyBand(reformSavings.annual),
      confidence: 'Estimated',
      urgency: 'High',
      evidence: [
        `Credit card turnover detected`,
        `Consumer credit interchange cap changes from 1 October 2026`,
      ],
      module: 'reform',
    });
  }

  if (hasDebit && !lcrConfirmedOn && !lcrUnavailable && lcrSavings) {
    opportunities.push({
      id: 'least-cost-routing',
      title: 'Debit routing / least-cost routing',
      category: 'Cost reduction',
      estimatedAnnualValue: lcrSavings.annual,
      valueBand: moneyBand(lcrSavings.annual),
      confidence: lcrStatus === 'off' ? 'Likely' : 'Needs validation',
      urgency: 'Medium',
      evidence: [
        `${debitPct.toFixed(1)}% debit mix`,
        `LCR status observed as ${report.lcrStatus || 'unknown'}`,
      ],
      module: 'lcr',
    });
  }

  const surchargeObs = [report.surchargeDetected, report.surcharging, ...(Array.isArray(report.observations) ? report.observations : [])]
    .filter(Boolean).join(' ').toLowerCase();
  if (/surcharge|surcharging|card surcharge/.test(surchargeObs)) {
    opportunities.push({
      id: 'surcharge-reform',
      title: 'Surcharge strategy before October 2026',
      category: 'Regulatory / margin planning',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: 'Needs validation',
      urgency: 'High',
      evidence: ['Surcharging appears relevant from the submission or observations'],
      module: 'surcharge',
    });
  }

  if (report.pricingModel || report.providerRate || Array.isArray(report.feeBreakdown)) {
    opportunities.push({
      id: 'pricing-structure',
      title: 'Pricing structure and provider margin',
      category: 'Commercial review',
      estimatedAnnualValue: null,
      valueBand: 'Strategic',
      confidence: report.providerRate ? 'Confirmed' : 'Needs validation',
      urgency: 'Medium',
      evidence: [report.pricingModel ? `Pricing model: ${report.pricingModel}` : 'Pricing model not clearly stated'],
      module: 'pricing',
    });
  }

  if (report.chargebacks) {
    opportunities.push({
      id: 'chargebacks',
      title: 'Chargeback visibility and risk',
      category: 'Risk management',
      estimatedAnnualValue: report.chargebacks.fees || null,
      valueBand: report.chargebacks.fees ? moneyBand(report.chargebacks.fees * 12) : 'Strategic',
      confidence: 'Confirmed',
      urgency: report.chargebacks.ratio && report.chargebacks.ratio > 0.65 ? 'High' : 'Medium',
      evidence: ['Chargeback data is visible in the statement'],
      module: 'chargebacks',
    });
  } else {
    // Keep a light visibility module for online/high-risk businesses, but this should not dominate priorities.
    const ctx = lower(report.businessType || report.industry || report.channel || '');
    if (/online|ecommerce|e-commerce|card-not-present|cnp/.test(ctx)) {
      opportunities.push({
        id: 'chargeback-visibility',
        title: 'Chargeback visibility',
        category: 'Data completeness',
        estimatedAnnualValue: null,
        valueBand: 'Strategic',
        confidence: 'Needs validation',
        urgency: 'Low',
        evidence: ['Chargeback data is not visible on the statement'],
        module: 'chargebacks',
      });
    }
  }

  return opportunities.sort(compareOpportunities);
}

function compareOpportunities(a, b) {
  const urgency = { High: 3, Medium: 2, Low: 1 };
  const confidence = { Confirmed: 3, Likely: 2.5, Estimated: 2, 'Needs validation': 1 };
  const valueA = Number(a.estimatedAnnualValue) || 0;
  const valueB = Number(b.estimatedAnnualValue) || 0;
  if (valueA !== valueB) return valueB - valueA;
  if ((urgency[a.urgency] || 0) !== (urgency[b.urgency] || 0)) return (urgency[b.urgency] || 0) - (urgency[a.urgency] || 0);
  return (confidence[b.confidence] || 0) - (confidence[a.confidence] || 0);
}

export function selectModules({ report, opportunities, feeComposition, benchmarkBars }) {
  const moduleSet = new Set(['executive', 'findings', 'snapshot', 'fee', 'stack', 'benchmark', 'priorities', 'cta']);
  if (feeComposition) moduleSet.add('fee');
  if (benchmarkBars) moduleSet.add('benchmark');

  for (const opp of opportunities) {
    if (opp.module === 'pricing') moduleSet.add('pricing');
    if (opp.module === 'reform') moduleSet.add('reform');
    if (opp.module === 'lcr') moduleSet.add('lcr');
    if (opp.module === 'chargebacks') moduleSet.add('chargebacks');
    if (opp.module === 'surcharge') moduleSet.add('surcharge');
  }

  // Sensible defaults: keep pricing if we know the model; keep reform if credit mix exists.
  if (report.pricingModel || report.providerRate) moduleSet.add('pricing');
  if (report.cardMix?.credit != null && Number(report.cardMix.credit) > 0) moduleSet.add('reform');

  const preferredOrder = [
    'executive', 'findings', 'snapshot', 'fee', 'stack',
    'pricing', 'reform', 'lcr', 'surcharge', 'chargebacks',
    'benchmark', 'priorities', 'cta'
  ];
  return preferredOrder.filter(id => moduleSet.has(id));
}

export function topOpportunities(opportunities, max = 4) {
  return opportunities.slice(0, max);
}

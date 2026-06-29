// api/_lib/pit/selectModules.js
// Selects which report modules should be composed from the PIT output.

export function selectReportModules({ facts, metrics, opportunities }) {
  const moduleSet = new Set(['executive', 'findings', 'snapshot', 'fee', 'stack', 'benchmark', 'priorities', 'cta']);
  if (metrics.feeComposition) moduleSet.add('fee');
  if (metrics.benchmarkBars) moduleSet.add('benchmark');

  for (const opp of opportunities || []) {
    if (opp.module === 'pricing') moduleSet.add('pricing');
    if (opp.module === 'reform') moduleSet.add('reform');
    if (opp.module === 'lcr') moduleSet.add('lcr');
    if (opp.module === 'chargebacks') moduleSet.add('chargebacks');
    if (opp.module === 'surcharge') moduleSet.add('surcharge');
    if (opp.module === 'stack') moduleSet.add('stack');
  }

  if (facts.pricingModel || facts.providerRate) moduleSet.add('pricing');
  if (facts.cardMix?.credit != null && Number(facts.cardMix.credit) > 0) moduleSet.add('reform');

  const preferredOrder = [
    'executive', 'findings', 'snapshot', 'fee', 'stack',
    'pricing', 'reform', 'lcr', 'surcharge', 'chargebacks',
    'benchmark', 'priorities', 'cta'
  ];
  return preferredOrder.filter(id => moduleSet.has(id));
}

export function topOpportunities(opportunities, max = 4) {
  return (opportunities || []).slice(0, max);
}

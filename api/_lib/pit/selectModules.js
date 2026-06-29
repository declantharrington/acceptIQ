// api/_lib/pit/selectModules.js
// Selects which report modules should be composed from the PIT output.
// Report Engine v2 separates the narrative flow from the diagnostic modules.

export function selectReportModules({ facts, metrics, opportunities }) {
  const moduleSet = new Set(['landscape', 'takeaways', 'snapshot', 'stack', 'priorities', 'cta']);

  // Fee analysis is now integrated into the Operating Snapshot page.
  if (metrics.feeComposition) moduleSet.add('snapshot');

  for (const opp of opportunities || []) {
    if (opp.module === 'pricing') moduleSet.add('pricing');
    if (opp.module === 'reform') moduleSet.add('reform');
    if (opp.module === 'lcr') moduleSet.add('lcr');
    if (opp.module === 'chargebacks') moduleSet.add('chargebacks');
    if (opp.module === 'surcharge') moduleSet.add('surcharge');
    if (opp.module === 'stack') moduleSet.add('stack');
  }

  // Sensible defaults based on visible facts.
  if (facts.pricingModel || facts.providerRate) moduleSet.add('pricing');
  if (facts.cardMix?.credit != null && Number(facts.cardMix.credit) > 0) moduleSet.add('reform');
  if (metrics.benchmarkBars) moduleSet.add('benchmark');

  const preferredOrder = [
    'landscape', 'takeaways', 'snapshot', 'stack',
    'pricing', 'reform', 'lcr', 'surcharge', 'chargebacks', 'benchmark',
    'priorities', 'cta'
  ];
  return preferredOrder.filter(id => moduleSet.has(id));
}

export function topOpportunities(opportunities, max = 4) {
  return (opportunities || []).slice(0, max);
}

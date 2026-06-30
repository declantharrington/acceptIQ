// api/_lib/pit/selectModules.js
// Module Selector: chooses report modules and assigns importance.
// The ids returned here must match the ids consumed by reportTemplate.js.

export function selectModules({ facts, metrics, findings, opportunities, riskIntelligence, dataQuality }) {
  const modules = [
    { id: 'landscape', type: 'foundation', priority: 'major', reason: 'Always sets Australian payments market context.' },
    { id: 'takeaways', type: 'foundation', priority: 'major', reason: 'Always summarises key observations from merchant data.' },
    { id: 'snapshot', type: 'foundation', priority: 'major', reason: 'Always establishes operating facts and fee drivers.' }
  ];

  const hasModule = id => modules.some(m => m.id === id);
  const addModule = module => { if (!hasModule(module.id)) modules.push(module); };

  // Stack review is useful whenever there are visible stack components or material data gaps.
  if (facts?.setup?.length || riskIntelligence?.risks?.length || dataQuality?.gaps?.length) {
    addModule({ id: 'stack', type: 'diagnostic', priority: 'supporting', reason: 'Shows visible and missing stack components.' });
  }

  for (const opp of opportunities || []) {
    const id = moduleIdForOpportunity(opp);
    if (!id) continue;

    addModule({
      id,
      type: 'diagnostic',
      priority: classifyPriority(opp),
      reason: opp.title,
      opportunityId: opp.id,
      confidence: opp.confidence
    });
  }

  // Benchmark is a useful diagnostic if an effective rate exists.
  if (metrics?.effectiveRate != null) {
    addModule({ id: 'benchmark', type: 'diagnostic', priority: 'supporting', reason: 'Positions the merchant against market benchmarks.' });
  }

  addModule({ id: 'priorities', type: 'summary', priority: 'major', reason: 'Always summarises opportunity value and validation priorities.' });
  addModule({ id: 'cta', type: 'cta', priority: 'major', reason: 'Always closes with engagement path.' });

  return modules;
}

function classifyPriority(opp) {
  if (Number(opp.estimatedAnnualValue) >= 10000 || opp.urgency === 'High') return 'major';
  if (opp.confidence === 'Confirmed' || opp.confidence === 'Likely') return 'supporting';
  return 'minor';
}

function moduleIdForOpportunity(opp) {
  return {
    pricing: 'pricing',
    reform: 'reform',
    lcr: 'lcr',
    surcharge: 'surcharge',
    chargebacks: 'chargebacks',
    stack: 'stack'
  }[opp.module] || opp.module;
}

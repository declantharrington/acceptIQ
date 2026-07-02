// api/_lib/pit/selectModules.js
// Module Selector
// Chooses report modules from business priorities and PIT intelligence.

export function selectModules({ facts, metrics, findings, opportunities, riskIntelligence, dataQuality, commercialReasoning, businessPriorities = [] }) {
  const modules = [
    { id: 'landscape', type: 'foundation', priority: 'major', reason: 'Always sets market context.' },
    { id: 'takeaways', type: 'foundation', priority: 'major', reason: 'Always summarises headline observations.' },
    { id: 'snapshot', type: 'foundation', priority: 'major', reason: 'Always establishes merchant facts.' }
  ];

  const source = businessPriorities.length ? businessPriorities : (opportunities || []).map((o, i) => ({
    ...o,
    rank: i + 1,
    opportunityId: o.id
  }));

  for (const item of source) {
    const opp = item.opportunityId
      ? (opportunities || []).find(o => o.id === item.opportunityId) || item
      : item;

    const id = moduleIdForOpportunity(opp);
    if (!id || modules.some(m => m.id === id)) continue;

    modules.push({
      id,
      type: 'diagnostic',
      priority: classifyModulePriority(item, opp),
      reason: item.rankReason || opp.title,
      opportunityId: opp.id,
      confidence: opp.confidence
    });
  }

  if (!modules.some(m => m.id === 'benchmark')) {
    modules.push({
      id: 'benchmark',
      type: 'diagnostic',
      priority: 'supporting',
      reason: 'Benchmarking provides market position.'
    });
  }

  if ((riskIntelligence?.risks || []).length || (dataQuality?.gaps || []).length) {
    modules.push({
      id: 'data-gaps-risk',
      type: 'diagnostic',
      priority: 'minor',
      reason: 'Data gaps and risks should be captured compactly.'
    });
  }

  modules.push({ id: 'opportunity-summary', type: 'summary', priority: 'major', reason: 'Always summarises opportunity value and validation priorities.' });
  modules.push({ id: 'cta', type: 'cta', priority: 'major', reason: 'Always closes with engagement path.' });

  return modules;
}

function classifyModulePriority(priority, opp) {
  if (priority.priorityWeight >= 9) return 'major';
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
    stack: 'stack',
    gateway: 'stack'
  }[opp.module] || opp.module;
}

// api/_lib/pit/engines/priorityEngine.js
// Business Priority Engine
// Converts opportunities and commercial understanding into ranked business priorities.

const urgencyRank = { High: 3, Medium: 2, Low: 1 };
const confidenceRank = { Confirmed: 4, High: 4, Likely: 3, Estimated: 2, Medium: 2, 'Needs validation': 1, Low: 1 };

export function buildBusinessPriorities({ opportunities = [], understandings = [], risks = [] }) {
  const priorities = opportunities.map((opp, index) => {
    const annual = Number(opp.estimatedAnnualValue) || 0;
    const commercialWeight = annual >= 50000 ? 5 : annual >= 10000 ? 4 : annual > 0 ? 3 : 1;
    const urgencyWeight = urgencyRank[opp.urgency] || 0;
    const confidenceWeight = confidenceRank[opp.confidence] || 0;
    const riskWeight = relatedRiskWeight(opp, risks);

    const priorityWeight = commercialWeight + urgencyWeight + confidenceWeight + riskWeight;

    return {
      id: `PRI-${String(index + 1).padStart(3, '0')}`,
      opportunityId: opp.id,
      title: opp.title,
      category: opp.category,
      priorityWeight,
      rankReason: buildRankReason(opp, { annual, commercialWeight, urgencyWeight, confidenceWeight, riskWeight }),
      estimatedAnnualValue: opp.estimatedAnnualValue ?? null,
      confidence: opp.confidence,
      urgency: opp.urgency,
      complexity: opp.complexity,
      evidence: opp.evidence || [],
      dependsOn: relatedUnderstandingIds(opp, understandings),
      module: opp.module
    };
  });

  priorities.sort((a, b) => b.priorityWeight - a.priorityWeight);

  return priorities.map((p, i) => ({ ...p, rank: i + 1 }));
}

function relatedRiskWeight(opp, risks) {
  if (opp.id === 'surcharge-planning' && risks.some(r => r.id === 'surcharge-reform-risk')) return 2;
  if (opp.id === 'least-cost-routing' && risks.some(r => r.id === 'routing-visibility-risk')) return 1;
  if (opp.id === 'total-cost-visibility' && risks.some(r => r.id === 'incomplete-cost-risk')) return 1;
  return 0;
}

function relatedUnderstandingIds(opp, understandings) {
  const out = [];
  for (const u of understandings) {
    const text = `${u.title} ${u.conclusion}`.toLowerCase();
    if (opp.id === 'least-cost-routing' && /routing|debit/.test(text)) out.push(u.id);
    if (opp.id === 'october-reform' && /reform|interchange/.test(text)) out.push(u.id);
    if (opp.id === 'surcharge-planning' && /surcharge/.test(text)) out.push(u.id);
    if (opp.id === 'pricing-structure' && /pricing|margin/.test(text)) out.push(u.id);
  }
  return out;
}

function buildRankReason(opp, { annual, commercialWeight, urgencyWeight, confidenceWeight, riskWeight }) {
  const parts = [];
  if (annual > 0) parts.push(`quantified value of $${Math.round(annual).toLocaleString('en-AU')}/yr`);
  if (opp.urgency) parts.push(`${opp.urgency.toLowerCase()} urgency`);
  if (opp.confidence) parts.push(`${opp.confidence.toLowerCase()} confidence`);
  if (riskWeight) parts.push('linked risk exposure');
  return parts.length ? `Prioritised due to ${parts.join(', ')}.` : 'Prioritised as a strategic validation area.';
}

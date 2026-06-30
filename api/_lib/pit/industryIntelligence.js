// api/_lib/pit/industryIntelligence.js
// Industry Intelligence: overlays Australian payments rules, benchmarks and market changes.

export function buildIndustryIntelligence({ facts, metrics }) {
  const reforms = [];
  if (metrics.cardMix.creditPct > 0) reforms.push({ id:'consumer-credit-interchange-2026', title:'Consumer credit interchange reform', date:'1 October 2026', relevance:'Credit volume detected', implication:'Consumer credit wholesale costs reduce materially if pass-through occurs.', confidence:'Estimated', estimatedAnnualValue:metrics.reformSavings?.annual || null });
  const surchargeRelevant = /surcharge/i.test([facts.context?.surcharge, facts.context?.raw, facts.observations?.join(' ')].join(' '));
  if (surchargeRelevant) reforms.push({ id:'surcharge-removal-2026', title:'Surcharge removal', date:'1 October 2026', relevance:'Surcharging appears relevant to this merchant.', implication:'Pricing and margin planning should be reviewed before surcharging is removed.', confidence:'Needs validation', estimatedAnnualValue:null });
  if (metrics.cardMix.foreignPct > 0) reforms.push({ id:'foreign-card-interchange-2027', title:'Foreign-issued card interchange cap', date:'1 April 2027', relevance:'Foreign card volume detected.', implication:'Foreign card costs may reduce once new caps commence.', confidence:'Estimated', estimatedAnnualValue:null });
  return { marketFacts:[{id:'cash-decline',fact:'Cash has fallen from around 70% of in-person payments in 2007 to around 15% in 2025.'},{id:'surcharge-cost',fact:'Australians pay an estimated ~$1.8B per year in card surcharges.'},{id:'small-business-gap',fact:'Small merchants on blended plans typically pay materially more than large strategic merchants.'}], relevantReforms:reforms, benchmarks:metrics.benchmarkPosition };
}

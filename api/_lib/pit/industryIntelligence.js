// api/_lib/pit/industryIntelligence.js
// Industry Intelligence
// Applies Australian payments market context, regulatory reform and benchmarks
// to the merchant's facts. This remains deterministic and grounded.

export function buildIndustryIntelligence({ facts = {}, metrics = {}, merchantProfile = {} }) {
  const reforms = [];
  const marketContext = [];
  const benchmarkSignals = [];

  marketContext.push({
    id: 'cash-decline',
    theme: 'Consumer behaviour',
    fact: 'Cash has fallen from roughly 70% of in-person payments in 2007 to around 15% in 2025.',
    relevance: 'Payments costs now affect a much larger share of merchant revenue.'
  });

  marketContext.push({
    id: 'surcharge-cost',
    theme: 'Cost transparency',
    fact: 'Australians pay an estimated ~$1.8B per year in card surcharges.',
    relevance: 'Card acceptance costs are now a mainstream consumer and merchant issue.'
  });

  marketContext.push({
    id: 'small-large-gap',
    theme: 'Market pricing',
    fact: 'Small merchants typically pay materially more than large merchants for the same card sale.',
    relevance: 'Pricing structure and provider margin should be validated against market position.'
  });

  if ((metrics.cardMix?.creditPct ?? facts.cardMix?.credit ?? 0) > 0) {
    reforms.push({
      id: 'consumer-credit-interchange-2026',
      name: 'Consumer credit interchange reform',
      date: '1 October 2026',
      status: 'Confirmed',
      applies: true,
      relevance: 'Credit card volume is visible in the statement.',
      commercialImplication: 'Consumer credit wholesale costs reduce materially if the saving is passed through.',
      estimatedAnnualValue: metrics.reformSavings?.annual ?? null,
      confidence: metrics.reformSavings ? 'Estimated' : 'Needs validation',
      module: 'reform'
    });
  }

  const surchargeText = [
    facts.context?.surcharge,
    facts.context?.raw,
    facts.observations?.join(' ')
  ].join(' ');

  if (/surcharge|surcharging/i.test(surchargeText)) {
    reforms.push({
      id: 'surcharge-removal-2026',
      name: 'Surcharge removal',
      date: '1 October 2026',
      status: 'Confirmed',
      applies: true,
      relevance: 'Surcharging appears relevant from the questionnaire or observations.',
      commercialImplication: 'The merchant may need to absorb card costs or adjust headline pricing after surcharging is removed.',
      estimatedAnnualValue: null,
      confidence: 'Needs validation',
      module: 'surcharge'
    });
  }

  if ((metrics.cardMix?.foreignPct ?? facts.cardMix?.foreign ?? 0) > 0) {
    reforms.push({
      id: 'foreign-card-cap-2027',
      name: 'Foreign-issued card interchange cap',
      date: '1 April 2027',
      status: 'Confirmed',
      applies: true,
      relevance: 'Foreign card exposure is visible.',
      commercialImplication: 'Foreign card costs may reduce after new caps commence.',
      estimatedAnnualValue: null,
      confidence: 'Estimated',
      module: 'foreign-card'
    });
  }

  if (metrics.benchmarkPosition) {
    benchmarkSignals.push({
      id: 'effective-rate-benchmark',
      metric: 'Effective rate',
      value: metrics.benchmarkPosition.effectiveRate,
      position: metrics.benchmarkPosition.position,
      references: metrics.benchmarkPosition.refs,
      confidence: 'Estimated'
    });
  }

  return {
    marketContext,
    reforms,
    benchmarkSignals,
    regulatoryCalendar: reforms.map(r => ({
      date: r.date,
      item: r.name,
      relevance: r.relevance
    })),
    industryNarrativeInputs: {
      landscapeStats: marketContext,
      relevantReforms: reforms,
      benchmarkSignals
    }
  };
}

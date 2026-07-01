// api/_lib/pit/buildCaseSummary.js
// Case Intelligence
// Produces a reusable summary for reports, dashboards, AI Analyst and admin review.

export function buildCaseSummary({
  merchantProfile = {},
  paymentsStack = {},
  metrics = {},
  findings = [],
  opportunities = [],
  risks = [],
  dataQuality = {},
  commercialReasoning = {},
  operationalIntelligence = {},
  industryIntelligence = {}
}) {
  const topOpportunities = opportunities.slice(0, 5);
  const quantifiedAnnualOpportunity = topOpportunities.reduce(
    (sum, opp) => sum + (Number(opp.estimatedAnnualValue) || 0),
    0
  );

  return {
    merchantName: merchantProfile.name || 'Merchant',
    headline: commercialReasoning.primaryCommercialTheme || 'Payments review generated',
    summary: commercialReasoning.whyItMatters || '',
    currentPosition: {
      provider: paymentsStack.acquirerOrProvider || null,
      pricingModel: paymentsStack.pricingModel || null,
      effectiveRate: metrics.effectiveRate ?? null,
      cardVolume: metrics.volume ?? null,
      totalFees: metrics.totalFees ?? null,
      transactions: metrics.transactions ?? null,
      debitMix: metrics.cardMix?.debitPct ?? null,
      creditMix: metrics.cardMix?.creditPct ?? null,
      benchmarkPosition: metrics.benchmarkPosition?.position || null
    },
    intelligenceStatus: {
      dataQuality: dataQuality.qualityLevel || 'Unknown',
      stackCompleteness: paymentsStack.completeness || 'Unknown',
      riskProfile: risks.length ? summariseRiskProfile(risks) : 'No major risks visible from current data',
      operationalVisibility: operationalIntelligence.profile?.operationalMaturity || 'Unknown'
    },
    quantifiedAnnualOpportunity: quantifiedAnnualOpportunity || null,
    topOpportunities: topOpportunities.map(o => ({
      id: o.id,
      title: o.title,
      category: o.category,
      estimatedAnnualValue: o.estimatedAnnualValue ?? null,
      valueBand: o.valueBand,
      confidence: o.confidence,
      urgency: o.urgency,
      complexity: o.complexity,
      evidence: o.evidence || [],
      dependencies: o.dependencies || []
    })),
    keyFindings: findings.slice(0, 6).map(f => ({
      id: f.id,
      category: f.category,
      title: f.title,
      confidence: f.confidence,
      evidence: f.evidence || []
    })),
    keyRisks: risks.slice(0, 5).map(r => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      confidence: r.confidence,
      validation: r.validation
    })),
    dataGaps: (dataQuality.gaps || []).slice(0, 6),
    relevantReforms: industryIntelligence.reforms || [],
    reasoning: {
      primaryCommercialTheme: commercialReasoning.primaryCommercialTheme,
      evidenceChain: commercialReasoning.evidenceChain || [],
      priorityLogic: commercialReasoning.priorityLogic || [],
      deEmphasise: commercialReasoning.deEmphasise || [],
      validationSequence: commercialReasoning.validationSequence || []
    }
  };
}

function summariseRiskProfile(risks) {
  if (risks.some(r => r.severity === 'High')) return 'Material validation required';
  if (risks.some(r => r.severity === 'Medium')) return 'Some validation required';
  if (risks.length) return 'Minor visibility gaps';
  return 'No major risks visible from current data';
}

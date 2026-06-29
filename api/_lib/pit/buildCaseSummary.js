// api/_lib/pit/buildCaseSummary.js
// Compact summary for admin/PIT console use. This is deterministic and safe to store.

export function buildCaseSummary({ merchantProfile, paymentsStack, metrics, findings, opportunities, dataGaps, selectedModules }) {
  return {
    merchant: merchantProfile.companyName,
    contact: merchantProfile.contactName,
    provider: paymentsStack.acquirer,
    period: merchantProfile.statementPeriod,
    headlineMetrics: {
      volume: metrics?.snapshot?.creditVolume != null || metrics?.snapshot?.debitVolume != null ? null : undefined,
      totalAnnualOpportunity: metrics?.snapshot?.totalAnnualOpportunity || 0,
      debitMix: metrics?.snapshot?.debitPct ?? null,
      creditMix: metrics?.snapshot?.creditPct ?? null
    },
    findingsCount: findings.length,
    opportunities: opportunities.slice(0, 4).map(o => ({
      id: o.id,
      title: o.title,
      category: o.category,
      estimatedAnnualValue: o.estimatedAnnualValue,
      confidence: o.confidence,
      urgency: o.urgency
    })),
    dataGaps,
    selectedModules
  };
}

// api/_lib/report/metrics/calculateMetrics.js
// Backwards-compatible report adapter. Metric logic now lives in the PIT.

export {
  calculatePITMetrics as calculateReportMetrics,
  calculateAvgFeePerTxn,
  calculateFeeComposition,
  derivePricingModelFromFeeComposition,
  calculateBenchmarkBars,
  calculateReformSavings,
  calculateLcrSavings,
  calculateSnapshot
} from '../../pit/calculateMetrics.js';

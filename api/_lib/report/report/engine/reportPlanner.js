// api/_lib/report/engine/reportPlanner.js
// Backwards-compatible adapter for older report code. New flow should use buildPIT().

import { identifyOpportunities } from '../../pit/identifyOpportunities.js';
import { selectReportModules, topOpportunities } from '../../pit/selectModules.js';

export function planReport({ report, metrics }) {
  const merchantProfile = { rawProgramContext: '', channel: report.channel || report.businessType || null };
  const paymentsStack = {
    gatewayDetected: false,
    sourceCoverage: { gatewayInvoice: false }
  };
  const opportunities = identifyOpportunities({ facts: report, metrics, merchantProfile, paymentsStack, findings: [] });
  const selectedModules = selectReportModules({ facts: report, metrics, opportunities });
  const priorityOpportunities = topOpportunities(opportunities, 4);
  return { opportunities, selectedModules, priorityOpportunities };
}

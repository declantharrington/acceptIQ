// api/_lib/pit/buildPIT.js
// Payments Intelligence Engine v1.
// This sits between ingestion and modules. It turns factual inputs into a
// reusable intelligence object that can power reports, chat, dashboards and
// future modules.

import { normaliseFacts } from './normaliseFacts.js';
import { buildMerchantProfile } from './merchantProfile.js';
import { buildPaymentsStack } from './paymentsStack.js';
import { calculatePITMetrics } from './calculateMetrics.js';
import { identifyFindings } from './identifyFindings.js';
import { identifyOpportunities } from './identifyOpportunities.js';
import { identifyDataGaps } from './dataQuality.js';
import { selectReportModules, topOpportunities } from './selectModules.js';
import { buildCaseSummary } from './buildCaseSummary.js';

export function buildPIT({ report, programContext = '', adminNotes = '' }) {
  const facts = normaliseFacts(report || {});
  const merchantProfile = buildMerchantProfile({ facts, programContext });
  const paymentsStack = buildPaymentsStack({ facts, merchantProfile });
  const metrics = calculatePITMetrics(facts);
  const findings = identifyFindings({ facts, metrics, paymentsStack, merchantProfile });
  const opportunities = identifyOpportunities({ facts, metrics, paymentsStack, merchantProfile, findings });
  const dataGaps = identifyDataGaps({ facts, paymentsStack, merchantProfile });
  const selectedModules = selectReportModules({ facts, metrics, opportunities });
  const priorityOpportunities = topOpportunities(opportunities, 4);

  const reportPlan = {
    selectedModules,
    opportunities,
    priorityOpportunities
  };

  const caseSummary = buildCaseSummary({
    merchantProfile,
    paymentsStack,
    metrics,
    findings,
    opportunities,
    dataGaps,
    selectedModules
  });

  return {
    version: 'pit-v1',
    createdAt: new Date().toISOString(),
    sourceTypes: ['merchant_statement', 'questionnaire'],
    facts,
    merchantProfile,
    paymentsStack,
    metrics,
    findings,
    opportunities,
    dataGaps,
    reportPlan,
    caseSummary,
    analystContext: {
      adminNotes: adminNotes || ''
    }
  };
}

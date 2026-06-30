// api/_lib/pit/buildPIT.js
// Payments Intelligence Terminal (PIT)
// The central intelligence engine that turns payments data into reusable case intelligence.

import { normaliseFacts } from './normaliseFacts.js';
import { buildMerchantProfile } from './merchantProfile.js';
import { buildPaymentsStack } from './paymentsStack.js';
import { calculateMetrics } from './calculateMetrics.js';
import { buildCommercialIntelligence } from './commercialIntelligence.js';
import { buildOperationalIntelligence } from './operationalIntelligence.js';
import { buildIndustryIntelligence } from './industryIntelligence.js';
import { buildRiskIntelligence } from './riskIntelligence.js';
import { identifyFindings } from './identifyFindings.js';
import { identifyOpportunities } from './identifyOpportunities.js';
import { assessDataQuality } from './dataQuality.js';
import { selectModules } from './selectModules.js';
import { buildCommercialReasoning } from './commercialReasoning.js';
import { buildCaseSummary } from './buildCaseSummary.js';

export function buildPIT({ report = {}, programContext = '', overrides = {}, adminNotes = '' } = {}) {
  const facts = normaliseFacts(report, programContext);
  const merchantProfile = buildMerchantProfile(facts);
  const paymentsStack = buildPaymentsStack(facts, merchantProfile);
  const metrics = calculateMetrics(facts);

  const commercialIntelligence = buildCommercialIntelligence({ facts, metrics, paymentsStack });
  const operationalIntelligence = buildOperationalIntelligence({ facts, merchantProfile, paymentsStack });
  const industryIntelligence = buildIndustryIntelligence({ facts, metrics, merchantProfile });
  const riskIntelligence = buildRiskIntelligence({ facts, merchantProfile, paymentsStack, metrics, operationalIntelligence });
  const dataQuality = assessDataQuality({ facts, paymentsStack, operationalIntelligence });

  const findings = identifyFindings({
    facts,
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    operationalIntelligence,
    industryIntelligence,
    riskIntelligence
  });

  const opportunities = identifyOpportunities({
    facts,
    metrics,
    paymentsStack,
    commercialIntelligence,
    industryIntelligence,
    riskIntelligence
  });

  const commercialReasoning = buildCommercialReasoning({
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    opportunities,
    risks: riskIntelligence.risks
  });

  const modulePlan = selectModules({ facts, metrics, findings, opportunities, riskIntelligence, dataQuality });
  const selectedModules = modulePlan.map(m => m.id);
  const priorityOpportunities = opportunities.slice(0, 4);

  const caseSummary = buildCaseSummary({
    merchantProfile,
    paymentsStack,
    metrics,
    findings,
    opportunities,
    risks: riskIntelligence.risks,
    dataQuality,
    commercialReasoning
  });

  return {
    version: 'PIT v2',
    generatedAt: new Date().toISOString(),
    facts,
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    operationalIntelligence,
    industryIntelligence,
    riskIntelligence,
    findings,
    opportunities,
    dataQuality,
    commercialReasoning,
    modulePlan,
    selectedModules,
    priorityOpportunities,
    reportPlan: {
      selectedModules,
      priorityOpportunities,
      modulePlan
    },
    caseSummary
  };
}

// api/_lib/pit/buildPIT.js
// Payments Intelligence Terminal (PIT)
// Central intelligence engine that turns payments data into reusable commercial understanding.

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
import { buildCommercialReasoning } from './commercialReasoning.js';
import { buildCaseSummary } from './buildCaseSummary.js';

import { buildCommercialObservations } from './engines/observationEngine.js';
import { buildCommercialUnderstanding } from './engines/understandingEngine.js';
import { buildBusinessPriorities } from './engines/priorityEngine.js';
import { buildConfidenceProfile } from './engines/confidenceEngine.js';
import { createEvidenceGraph } from './engines/evidenceEngine.js';

import { selectModules } from './selectModules.js';

export function buildPIT({ report = {}, programContext = '', overrides = {}, adminNotes = '' } = {}) {
  const facts = normaliseFacts(report, programContext);

  const merchantProfile = buildMerchantProfile(facts);
  const paymentsStack = buildPaymentsStack(facts, merchantProfile);
  const metrics = calculateMetrics(facts);

  const commercialIntelligence = buildCommercialIntelligence({
    facts,
    metrics,
    paymentsStack
  });

  const operationalIntelligence = buildOperationalIntelligence({
    facts,
    merchantProfile,
    paymentsStack,
    metrics
  });

  const industryIntelligence = buildIndustryIntelligence({
    facts,
    metrics,
    merchantProfile
  });

  const riskIntelligence = buildRiskIntelligence({
    facts,
    merchantProfile,
    paymentsStack,
    metrics,
    operationalIntelligence,
    industryIntelligence
  });

  const dataQuality = assessDataQuality({
    facts,
    paymentsStack,
    operationalIntelligence
  });

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

  const commercialObservations = buildCommercialObservations({
    facts,
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    operationalIntelligence,
    industryIntelligence,
    riskIntelligence,
    dataQuality,
    findings,
    opportunities
  });

  const commercialUnderstanding = buildCommercialUnderstanding({
    observations: commercialObservations,
    opportunities,
    metrics,
    commercialIntelligence
  });

  const businessPriorities = buildBusinessPriorities({
    opportunities,
    understandings: commercialUnderstanding,
    risks: riskIntelligence.risks
  });

  const confidenceProfile = buildConfidenceProfile({
    facts,
    metrics,
    paymentsStack,
    dataQuality,
    observations: commercialObservations,
    understandings: commercialUnderstanding,
    priorities: businessPriorities
  });

  const evidenceGraph = createEvidenceGraph(
    commercialObservations,
    commercialUnderstanding,
    businessPriorities
  );

  const commercialReasoning = buildCommercialReasoning({
    merchantProfile,
    paymentsStack,
    metrics,
    commercialIntelligence,
    operationalIntelligence,
    industryIntelligence,
    opportunities,
    risks: riskIntelligence.risks
  });

  const modulePlan = selectModules({
    facts,
    metrics,
    findings,
    opportunities,
    riskIntelligence,
    dataQuality,
    commercialReasoning,
    businessPriorities
  });

  const caseSummary = buildCaseSummary({
    merchantProfile,
    paymentsStack,
    metrics,
    findings,
    opportunities,
    risks: riskIntelligence.risks,
    dataQuality,
    commercialReasoning,
    operationalIntelligence,
    industryIntelligence
  });

  const selectedModules = modulePlan.map(m => m.id);
  const priorityOpportunities = opportunities.slice(0, 4);

  return {
    version: 'PIT v4-commercial-understanding',
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

    commercialObservations,
    commercialUnderstanding,
    businessPriorities,
    confidenceProfile,
    evidenceGraph,

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

    caseSummary,

    meta: {
      source: 'statement + questionnaire',
      adminNotes: adminNotes || null,
      overridesApplied: Object.keys(overrides || {}).length > 0
    }
  };
}

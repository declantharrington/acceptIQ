// api/_lib/report/engine/opportunityEngine.js
// Backwards-compatible report adapter. Opportunity logic now lives in the PIT.

export { moneyBand, identifyOpportunities as buildOpportunities } from '../../pit/identifyOpportunities.js';
export { selectReportModules as selectModules, topOpportunities } from '../../pit/selectModules.js';

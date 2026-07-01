// api/_lib/report/render/renderReport.js
// PIT-native final report composer. Presentation only: no intelligence decisions live here.

import { buildTemplate } from '../template/reportTemplate.js';
import { buildReplacements } from './buildReplacements.js';
import { replaceTokens } from './htmlHelpers.js';

export function renderReport({ pit, narrative = {}, identity = {}, report, metrics, selectedModules, priorityOpportunities } = {}) {
  // Backward-compatible fallbacks are accepted, but PIT is the primary source of truth.
  const modules = Array.isArray(selectedModules)
    ? selectedModules
    : Array.isArray(pit?.selectedModules)
      ? pit.selectedModules
      : Array.isArray(pit?.modulePlan)
        ? pit.modulePlan.map(m => m.id).filter(Boolean)
        : [];

  const template = buildTemplate({ modules, modulePlan: pit?.modulePlan || [] });
  const replacements = buildReplacements({
    pit,
    narrative,
    identity,
    // Compatibility only. New callers should not need these.
    report,
    metrics,
    selectedModules: modules,
    priorityOpportunities
  });

  return replaceTokens(template, replacements);
}

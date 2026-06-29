// api/_lib/report/render/renderReport.js
// Final report composer. It knows about templates and replacements only.

import { buildTemplate } from '../template/reportTemplate.js';
import { buildReplacements } from './buildReplacements.js';
import { replaceTokens } from './htmlHelpers.js';

export function renderReport({ report, metrics, narrative, identity, selectedModules, priorityOpportunities }) {
  const template = buildTemplate({ modules: selectedModules });
  const replacements = buildReplacements({ report, metrics, narrative, identity, priorityOpportunities });
  return replaceTokens(template, replacements);
}

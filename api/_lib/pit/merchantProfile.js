// api/_lib/pit/merchantProfile.js
// Builds the merchant profile from questionnaire context and statement facts.

import { lower, parseProgramContext } from './utils.js';

export function buildMerchantProfile({ facts, programContext = '' }) {
  const parsed = parseProgramContext(programContext);
  const ctx = lower(programContext);

  const revenueBand = (() => {
    if (ctx.includes('50mplus')) return 'enterprise';
    if (ctx.includes('20to50m') || ctx.includes('5to20m')) return 'mid-market';
    return 'smb';
  })();

  const channel = parsed.channel || inferChannel({ facts, context: ctx });

  return {
    companyName: parsed.companyName,
    contactName: parsed.contactName,
    merchantEmail: parsed.merchantEmail,
    phone: parsed.phone,
    website: parsed.website,
    industry: parsed.industry,
    businessType: parsed.businessType,
    channel,
    revenueBand,
    statementProvider: facts.provider || null,
    statementPeriod: facts.period || null,
    source: {
      statement: true,
      questionnaire: Boolean(programContext),
      apis: false,
      transactionReports: false,
      contracts: false
    },
    rawProgramContext: programContext || ''
  };
}

function inferChannel({ facts, context }) {
  const joined = [context, ...(facts.setup || []).map(s => `${s.label} ${s.value}`), ...(facts.observations || [])].join(' ').toLowerCase();
  if (/online|ecommerce|e-commerce|card-not-present|cnp|gateway|website/.test(joined)) return 'Online / CNP';
  if (/terminal|eftpos terminal|card present|in-store|store|pos/.test(joined)) return 'Card-present';
  return null;
}

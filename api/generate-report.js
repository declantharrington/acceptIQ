// api/generate-report.js
// Payments Intelligence Terminal (PIT) + Report Engine endpoint.
// External contract remains unchanged: admin calls /api/generate-report with { submissionId, overrides }.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';
import { fetchSubmissionById, updateSubmissionAfterReport } from './_lib/report/data/submissions.js';
import { applyAdminOverrides } from './_lib/report/core/applyOverrides.js';
import { determineRevenueBand, toneGuideFor } from './_lib/report/core/audience.js';
import { logFeeReconciliation } from './_lib/report/core/validation.js';
import { buildPIT } from './_lib/pit/buildPIT.js';
import { persistPIT } from './_lib/pit/persistPIT.js';
import { upsertMerchant, linkSubmissionToMerchant } from './_lib/merchants.js';
import { generateNarrative } from './_lib/report/narrative/generateNarrative.js';
import { renderReport } from './_lib/report/render/renderReport.js';
import { uploadReportHtml } from './_lib/report/storage/reportStorage.js';
import { isAuthorizedAdminRequest } from './_lib/admin/session.js';

export const config = { maxDuration: 120 };

const MODEL = 'claude-sonnet-4-6';

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!isAuthorizedAdminRequest(req)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { submissionId, overrides = {} } = req.body || {};
    if (!submissionId) return res.status(400).json({ error: 'submissionId required' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      console.error('generate-report: missing required environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const submission = await fetchSubmissionById({ supabaseUrl, supabaseKey, submissionId });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const programContext = submission.program_context || '';

    const { report, adminNotes } = applyAdminOverrides(
      JSON.parse(submission.report_json || '{}'),
      overrides
    );

    logFeeReconciliation(report);

    // The PIT is now the canonical intelligence object for this case.
    // Everything downstream should consume PIT rather than re-building intelligence.
    const pit = buildPIT({ report, programContext, overrides, adminNotes });

    let merchantId = submission.merchant_id || null;
    if (!merchantId) {
      merchantId = await upsertMerchant({ supabaseUrl, supabaseKey, programContext });
      if (merchantId) {
        await linkSubmissionToMerchant({ supabaseUrl, supabaseKey, submissionId, merchantId });
      }
    }

    await persistPIT({ supabaseUrl, supabaseKey, submissionId, merchantId, pit });

    const selectedModules = getSelectedModules(pit);
    const priorityOpportunities = getPriorityOpportunities(pit);

    const revenueBand = determineRevenueBand(programContext);
    const toneGuide = toneGuideFor(revenueBand);

    const narrative = await generateNarrative({
      anthropicKey,
      model: MODEL,
      paymentsKb: PAYMENTS_KB,
      toneGuide,
      selectedModules,
      priorityOpportunities,
      programContext,
      adminNotes,
      pit
    });

    const identity = {
      companyName: pit.merchantProfile?.name || 'Merchant',
      contactName: pit.merchantProfile?.contactName || null,
      merchantEmail: pit.merchantProfile?.contactEmail || null
    };

    const html = renderReport({ pit, narrative, identity });

    const htmlPath = await uploadReportHtml({
      supabaseUrl,
      supabaseKey,
      html,
      companyName: identity.companyName,
      provider: pit.facts?.provider || 'Unknown'
    });

    await updateSubmissionAfterReport({
      supabaseUrl,
      supabaseKey,
      submissionId,
      report: pit.facts,
      narrative,
      htmlPath
    });

    return res.status(200).json({ success: true, htmlPath });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('generate-report error:', message);
    if (err && err.stack) console.error(err.stack);
    return res.status(500).json({ error: message });
  }
}

function getSelectedModules(pit) {
  if (Array.isArray(pit?.selectedModules)) return pit.selectedModules;
  if (Array.isArray(pit?.modulePlan)) return pit.modulePlan.map(m => m.id).filter(Boolean);
  return [];
}

function getPriorityOpportunities(pit) {
  if (Array.isArray(pit?.priorityOpportunities)) return pit.priorityOpportunities;
  if (Array.isArray(pit?.caseSummary?.topOpportunities)) return pit.caseSummary.topOpportunities;
  if (Array.isArray(pit?.opportunities)) return pit.opportunities.slice(0, 4);
  return [];
}

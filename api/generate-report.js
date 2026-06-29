// api/generate-report.js
// Payments Intelligence Layer + Report Engine endpoint.
// This endpoint remains the same externally: the admin portal calls /api/generate-report
// with { submissionId, overrides }. Internally it now builds a PIT object first,
// then lets the Report Engine consume that PIT output.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';
import { fetchSubmissionById, updateSubmissionAfterReport } from './_lib/report/data/submissions.js';
import { applyAdminOverrides } from './_lib/report/core/applyOverrides.js';
import { determineRevenueBand, toneGuideFor } from './_lib/report/core/audience.js';
import { logFeeReconciliation } from './_lib/report/core/validation.js';
import { buildPIT } from './_lib/pit/buildPIT.js';
import { generateNarrative } from './_lib/report/narrative/generateNarrative.js';
import { renderReport } from './_lib/report/render/renderReport.js';
import { uploadReportHtml } from './_lib/report/storage/reportStorage.js';

export const config = { maxDuration: 120 };

const MODEL = 'claude-sonnet-4-6';

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { submissionId, overrides = {} } = req.body || {};
    if (!submissionId) return res.status(400).json({ error: 'submissionId required' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      console.error('generate-report: missing required environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 1. Load the submission/case.
    const submission = await fetchSubmissionById({ supabaseUrl, supabaseKey, submissionId });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const programContext = submission.program_context || '';

    // 2. Apply analyst/admin corrections before PIT runs.
    const { report, adminNotes } = applyAdminOverrides(JSON.parse(submission.report_json || '{}'), overrides);
    logFeeReconciliation(report);

    // 3. Build the Payments Intelligence Layer.
    //    This is the canonical object for downstream modules.
    const pit = buildPIT({ report, programContext, adminNotes });

    // Keep the corrected/derived facts in the variable name existing report code expects.
    const facts = pit.facts;
    const metrics = pit.metrics;
    const selectedModules = pit.reportPlan.selectedModules;
    const priorityOpportunities = pit.reportPlan.priorityOpportunities;

    // 4. Generate module narrative.
    const revenueBand = determineRevenueBand(programContext);
    const toneGuide = toneGuideFor(revenueBand);

    const narrative = await generateNarrative({
      anthropicKey,
      model: MODEL,
      paymentsKb: PAYMENTS_KB,
      toneGuide,
      selectedModules,
      report: facts,
      metrics,
      priorityOpportunities,
      programContext,
      adminNotes
    });

    // 5. Compose report from PIT + narrative.
    const identity = {
      companyName: pit.merchantProfile.companyName,
      contactName: pit.merchantProfile.contactName,
      merchantEmail: pit.merchantProfile.merchantEmail
    };

    const html = renderReport({
      report: facts,
      metrics,
      narrative,
      identity,
      selectedModules,
      priorityOpportunities
    });

    // 6. Persist generated report.
    const htmlPath = await uploadReportHtml({
      supabaseUrl,
      supabaseKey,
      html,
      companyName: identity.companyName,
      provider: facts.provider || 'Unknown'
    });

    await updateSubmissionAfterReport({
      supabaseUrl,
      supabaseKey,
      submissionId,
      report: facts,
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

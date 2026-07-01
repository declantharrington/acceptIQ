// api/generate-report.js
// Payments Intelligence Terminal (PIT) + Report Engine endpoint.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';
import { fetchSubmissionById, updateSubmissionAfterReport } from './_lib/report/data/submissions.js';
import { applyAdminOverrides } from './_lib/report/core/applyOverrides.js';
import { determineRevenueBand, toneGuideFor } from './_lib/report/core/audience.js';
import { logFeeReconciliation } from './_lib/report/core/validation.js';
import { buildPIT } from './_lib/pit/buildPIT.js';
import { persistPIT } from './_lib/pit/persistPIT.js';
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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
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

    const pit = buildPIT({
      report,
      programContext,
      overrides,
      adminNotes
    });

    const pitResultId = await persistPIT({
      supabaseUrl,
      supabaseKey,
      submissionId,
      merchantId: submission.merchant_id || null,
      pit
    });

    const facts = pit.facts || report;
    const metrics = pit.metrics || {};

    const selectedModules = Array.isArray(pit.selectedModules)
      ? pit.selectedModules
      : Array.isArray(pit.modulePlan)
        ? pit.modulePlan.map(m => m.id)
        : [];

    const priorityOpportunities = Array.isArray(pit.priorityOpportunities)
      ? pit.priorityOpportunities
      : Array.isArray(pit.opportunities)
        ? pit.opportunities.slice(0, 4)
        : [];

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
      adminNotes,
      pit
    });

    const identity = {
      companyName:
        pit.merchantProfile?.name ||
        pit.merchantProfile?.companyName ||
        'Merchant',
      contactName:
        pit.merchantProfile?.contactName ||
        null,
      merchantEmail:
        pit.merchantProfile?.contactEmail ||
        pit.merchantProfile?.merchantEmail ||
        null
    };

    const html = renderReport({
      report: facts,
      metrics,
      narrative,
      identity,
      selectedModules,
      priorityOpportunities,
      pit
    });

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
      htmlPath,
      pitResultId
    });

    return res.status(200).json({
      success: true,
      htmlPath,
      pitResultId
    });

  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('generate-report error:', message);
    if (err && err.stack) console.error(err.stack);
    return res.status(500).json({ error: message });
  }
}

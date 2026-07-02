// api/generate-report.js
// Payments Intelligence Terminal (PIT) + Report Engine endpoint.
// External contract remains unchanged: admin calls /api/generate-report with { submissionId, overrides }.
//
// New flow:
// - The PIT should normally run at submission time.
// - Report generation first tries to use the persisted PIT.
// - If admin overrides are supplied, or no PIT exists, it rebuilds and persists a fresh PIT.
// - The report is now an output of the PIT, not the place where intelligence is created.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';
import { fetchSubmissionById, updateSubmissionAfterReport } from './_lib/report/data/submissions.js';
import { applyAdminOverrides } from './_lib/report/core/applyOverrides.js';
import { determineRevenueBand, toneGuideFor } from './_lib/report/core/audience.js';
import { logFeeReconciliation } from './_lib/report/core/validation.js';
import { buildPIT } from './_lib/pit/buildPIT.js';
import {
  persistPIT,
  fetchLatestPITForSubmission,
  updateSubmissionPITMetadata
} from './_lib/pit/persistPIT.js';
import { upsertMerchant, linkSubmissionToMerchant } from './_lib/merchants.js';
import { generateNarrative } from './_lib/report/narrative/generateNarrative.js';
import { renderReport } from './_lib/report/render/renderReport.js';
import { uploadReportHtml } from './_lib/report/storage/reportStorage.js';
import { isAuthorizedAdminRequest } from './_lib/admin/session.js';

export const config = { maxDuration: 120 };

const MODEL = 'claude-sonnet-4-6';

function hasMeaningfulOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return false;
  return Object.values(overrides).some(v => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  });
}

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
    const overridesPresent = hasMeaningfulOverrides(overrides);

    let merchantId = submission.merchant_id || null;
    if (!merchantId) {
      merchantId = await upsertMerchant({ supabaseUrl, supabaseKey, programContext });
      if (merchantId) {
        await linkSubmissionToMerchant({ supabaseUrl, supabaseKey, submissionId, merchantId });
      }
    }

    let report;
    let adminNotes = '';
    let pit;
    let pitResultId = submission.latest_pit_result_id || null;

    if (!overridesPresent) {
      const latestPit = await fetchLatestPITForSubmission({ supabaseUrl, supabaseKey, submissionId });
      if (latestPit?.pit_json) {
        pit = latestPit.pit_json;
        pitResultId = latestPit.id || pitResultId;
        report = pit.facts || JSON.parse(submission.report_json || '{}');
        console.log(`generate-report: using persisted PIT ${pitResultId} for submission ${submissionId}`);
      }
    }

    if (!pit) {
      const corrected = applyAdminOverrides(JSON.parse(submission.report_json || '{}'), overrides);
      report = corrected.report;
      adminNotes = corrected.adminNotes;
      logFeeReconciliation(report);

      pit = buildPIT({ report, programContext, overrides, adminNotes });

      pitResultId = await persistPIT({
        supabaseUrl,
        supabaseKey,
        submissionId,
        merchantId,
        pit
      });

      if (pitResultId) {
        await updateSubmissionPITMetadata({ supabaseUrl, supabaseKey, submissionId, pitResultId });
      }

      console.log(`generate-report: built and persisted fresh PIT ${pitResultId || '(not saved)'} for submission ${submissionId}`);
    }

    const facts = pit.facts || report || {};
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
      companyName: pit.merchantProfile?.name || pit.merchantProfile?.companyName || 'Merchant',
      contactName: pit.merchantProfile?.contactName || null,
      merchantEmail: pit.merchantProfile?.contactEmail || pit.merchantProfile?.merchantEmail || null
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
      pitResultId,
      pitSource: overridesPresent ? 'rebuilt_with_overrides' : 'persisted_or_fallback'
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('generate-report error:', message);
    if (err && err.stack) console.error(err.stack);
    return res.status(500).json({ error: message });
  }
}

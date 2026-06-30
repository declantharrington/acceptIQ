// api/admin-data.js
// Authenticated proxy between the admin dashboard and Supabase.
//
// Actions (POST body: { action, ...params }):
//   list              -> recent submissions (legacy, kept for compatibility)
//   listMerchants     -> merchants with latest submission + PIT summary joined
//   getMerchant       -> { merchantId } single merchant + all submissions + latest pit_json
//   updateStatus      -> { id, status } patch on submissions
//   getReportHtml     -> { htmlPath } fetch from statements storage bucket

import { isAuthorizedAdminRequest } from './_lib/admin/session.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('admin-data: missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { action } = req.body || {};

  try {
    if (action === 'list')          return await handleList(req, res, supabaseUrl, supabaseKey);
    if (action === 'listMerchants') return await handleListMerchants(req, res, supabaseUrl, supabaseKey);
    if (action === 'getMerchant')   return await handleGetMerchant(req, res, supabaseUrl, supabaseKey);
    if (action === 'updateStatus')  return await handleUpdateStatus(req, res, supabaseUrl, supabaseKey);
    if (action === 'getReportHtml') return await handleGetReportHtml(req, res, supabaseUrl, supabaseKey);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('admin-data error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Supabase fetch helper ─────────────────────────────────────────────────────
async function sb(supabaseUrl, supabaseKey, path, options = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${detail}`);
  }
  return res.json();
}

// ── List merchants with joined summary data ───────────────────────────────────
// Supabase REST doesn't do JOINs, so we do three fetches and combine server-side.
// Returns one row per merchant with their latest submission stats and PIT summary.
async function handleListMerchants(req, res, supabaseUrl, supabaseKey) {
  // 1. All merchants
  const merchants = await sb(supabaseUrl, supabaseKey,
    'merchants?order=created_at.desc&limit=200'
  );
  if (!merchants.length) return res.status(200).json({ merchants: [] });

  const merchantIds = merchants.map(m => m.id);

  // 2. All submissions for these merchants (we'll find the latest per merchant)
  const submissions = await sb(supabaseUrl, supabaseKey,
    `submissions?merchant_id=in.(${merchantIds.join(',')})&order=submitted_at.desc&limit=1000&select=id,merchant_id,submitted_at,status,provider,period,volume,total_fees,effective_rate,pricing_model,lcr_status,report_html_path`
  );

  // 3. Latest pit_result per merchant (ordered by generated_at desc)
  const pitResults = await sb(supabaseUrl, supabaseKey,
    `pit_results?merchant_id=in.(${merchantIds.join(',')})&order=generated_at.desc&limit=1000&select=id,merchant_id,submission_id,pit_version,generated_at,pit_json`
  );

  // Group submissions by merchant, keep latest
  const subsByMerchant = {};
  const subCountByMerchant = {};
  for (const s of submissions) {
    subCountByMerchant[s.merchant_id] = (subCountByMerchant[s.merchant_id] || 0) + 1;
    if (!subsByMerchant[s.merchant_id]) subsByMerchant[s.merchant_id] = s; // already ordered desc
  }

  // Group pit_results by merchant, keep latest
  const pitByMerchant = {};
  for (const p of pitResults) {
    if (!pitByMerchant[p.merchant_id]) pitByMerchant[p.merchant_id] = p;
  }

  // Combine
  const result = merchants.map(m => {
    const latestSub = subsByMerchant[m.id] || null;
    const latestPit = pitByMerchant[m.id] || null;
    const pitSummary = latestPit?.pit_json?.caseSummary || null;

    return {
      ...m,
      submission_count: subCountByMerchant[m.id] || 0,
      latest_submission_id: latestSub?.id || null,
      latest_submitted_at: latestSub?.submitted_at || null,
      latest_status: latestSub?.status || null,
      latest_provider: latestSub?.provider || null,
      latest_period: latestSub?.period || null,
      latest_volume: latestSub?.volume || null,
      latest_total_fees: latestSub?.total_fees || null,
      latest_effective_rate: latestSub?.effective_rate || null,
      latest_pricing_model: latestSub?.pricing_model || null,
      latest_report_html_path: latestSub?.report_html_path || null,
      latest_pit_id: latestPit?.id || null,
      pit_version: latestPit?.pit_version || null,
      quantified_annual_opportunity: pitSummary?.quantifiedAnnualOpportunity || null,
      pit_headline: pitSummary?.headline || null,
      top_opportunities: pitSummary?.topOpportunities || [],
      key_findings: pitSummary?.keyFindings || []
    };
  });

  return res.status(200).json({ merchants: result });
}

// ── Get single merchant with full PIT detail ──────────────────────────────────
async function handleGetMerchant(req, res, supabaseUrl, supabaseKey) {
  const { merchantId } = req.body || {};
  if (!merchantId) return res.status(400).json({ error: 'merchantId required' });

  // Merchant row
  const merchants = await sb(supabaseUrl, supabaseKey,
    `merchants?id=eq.${merchantId}&limit=1`
  );
  if (!merchants.length) return res.status(404).json({ error: 'Merchant not found' });
  const merchant = merchants[0];

  // All submissions for this merchant
  const submissions = await sb(supabaseUrl, supabaseKey,
    `submissions?merchant_id=eq.${merchantId}&order=submitted_at.desc&limit=50`
  );

  // Latest pit_result with full pit_json
  const pitResults = await sb(supabaseUrl, supabaseKey,
    `pit_results?merchant_id=eq.${merchantId}&order=generated_at.desc&limit=1`
  );
  const latestPit = pitResults[0] || null;

  return res.status(200).json({ merchant, submissions, latestPit });
}

// ── Legacy: list submissions (kept so existing dashboard still works) ─────────
async function handleList(req, res, supabaseUrl, supabaseKey) {
  const sbRes = await fetch(`${supabaseUrl}/rest/v1/submissions?order=submitted_at.desc&limit=200`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!sbRes.ok) {
    const detail = await sbRes.text();
    return res.status(sbRes.status).json({ error: 'Failed to load submissions', detail });
  }
  const data = await sbRes.json();
  return res.status(200).json({ submissions: data });
}

// ── Update submission status ──────────────────────────────────────────────────
async function handleUpdateStatus(req, res, supabaseUrl, supabaseKey) {
  const { id, status } = req.body || {};
  if (!id || !status) return res.status(400).json({ error: 'id and status are required' });

  const ALLOWED_STATUSES = ['pending_review', 'reviewed', 'approved', 'sent'];
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  const sbRes = await fetch(`${supabaseUrl}/rest/v1/submissions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ status })
  });
  if (!sbRes.ok) {
    const detail = await sbRes.text();
    return res.status(sbRes.status).json({ error: 'Failed to update status', detail });
  }
  return res.status(200).json({ success: true });
}

// ── Fetch generated report HTML from storage ──────────────────────────────────
async function handleGetReportHtml(req, res, supabaseUrl, supabaseKey) {
  const { htmlPath } = req.body || {};
  if (!htmlPath) return res.status(400).json({ error: 'htmlPath is required' });

  if (typeof htmlPath !== 'string' || htmlPath.includes('..') || htmlPath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid htmlPath' });
  }

  const sbRes = await fetch(`${supabaseUrl}/storage/v1/object/statements/${htmlPath}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!sbRes.ok) {
    const detail = await sbRes.text();
    return res.status(sbRes.status).json({ error: 'Failed to fetch report', detail });
  }
  const html = await sbRes.text();
  return res.status(200).json({ html });
}

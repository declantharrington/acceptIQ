// api/admin-data.js
// Authenticated proxy between the admin dashboard and Supabase.
//
// Why this exists: public/admin/index.html used to call Supabase directly
// from the browser with the anon key. That key, plus permissive RLS
// policies, meant anyone with the page URL could read/write every
// submission with no login at all. RLS is now locked down to block the
// anon key entirely, so all dashboard data access goes through here
// instead, using the service_role key (server-side only, never sent to the
// browser) and gated behind a valid admin session cookie.
//
// Actions (POST body: { action, ...params }):
//   list           -> recent submissions (mirrors the old direct SELECT)
//   updateStatus   -> { id, status } patch (mirrors the old direct PATCH)
//   getReportHtml  -> { htmlPath } fetch from the statements storage bucket

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
    if (action === 'list') {
      return await handleList(req, res, supabaseUrl, supabaseKey);
    }
    if (action === 'updateStatus') {
      return await handleUpdateStatus(req, res, supabaseUrl, supabaseKey);
    }
    if (action === 'getReportHtml') {
      return await handleGetReportHtml(req, res, supabaseUrl, supabaseKey);
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('admin-data error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

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

async function handleUpdateStatus(req, res, supabaseUrl, supabaseKey) {
  const { id, status } = req.body || {};
  if (!id || !status) return res.status(400).json({ error: 'id and status are required' });

  // Keep this in sync with STATUS_LABEL/STATUS_CLASS in public/admin/index.html.
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

async function handleGetReportHtml(req, res, supabaseUrl, supabaseKey) {
  const { htmlPath } = req.body || {};
  if (!htmlPath) return res.status(400).json({ error: 'htmlPath is required' });

  // htmlPath comes from our own stored data (set by reportStorage.js), but
  // validate it stays within the expected shape before using it in a URL,
  // as defense in depth against an unexpected/manipulated value.
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

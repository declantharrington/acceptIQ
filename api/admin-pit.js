// api/admin-pit.js
// Authenticated PIT Viewer endpoint.
// Fetches persisted PIT results without regenerating intelligence or reports.

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
    console.error('admin-pit: missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { submissionId, merchantId, pitResultId } = req.body || {};

  try {
    let path;

    if (pitResultId) {
      path = `pit_results?id=eq.${encodeURIComponent(pitResultId)}&order=generated_at.desc&limit=1`;
    } else if (submissionId) {
      path = `pit_results?submission_id=eq.${encodeURIComponent(submissionId)}&order=generated_at.desc&limit=1`;
    } else if (merchantId) {
      path = `pit_results?merchant_id=eq.${encodeURIComponent(merchantId)}&order=generated_at.desc&limit=1`;
    } else {
      return res.status(400).json({ error: 'Provide pitResultId, submissionId or merchantId' });
    }

    const pitRes = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!pitRes.ok) {
      const detail = await pitRes.text();
      return res.status(pitRes.status).json({ error: 'Failed to fetch PIT result', detail });
    }

    const rows = await pitRes.json();
    const latestPit = Array.isArray(rows) ? rows[0] || null : null;
    return res.status(200).json({ latestPit, pit: latestPit?.pit_json || null });
  } catch (err) {
    console.error('admin-pit error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

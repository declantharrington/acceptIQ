// api/_lib/pit/persistPIT.js
// Persists and retrieves the Payments Intelligence Terminal (PIT).
//
// Design:
// - pit_results stores ONE canonical PIT object in pit_json.
// - The PIT is separate from the report. Reports, Abi, dashboards and future
//   modules should consume the persisted PIT rather than rebuilding intelligence.
// - One submission can have multiple PIT snapshots over time. The latest row
//   by generated_at is treated as current.

export async function persistPIT({
  supabaseUrl,
  supabaseKey,
  submissionId,
  merchantId = null,
  pit,
  status = 'completed'
}) {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('persistPIT: missing Supabase config - skipping persist');
    return null;
  }

  if (!submissionId) {
    console.warn('persistPIT: missing submissionId - skipping persist');
    return null;
  }

  if (!pit || typeof pit !== 'object') {
    console.warn('persistPIT: invalid PIT object - skipping persist');
    return null;
  }

  const payload = {
    submission_id: submissionId,
    merchant_id: merchantId || null,
    pit_version: pit.version || 'unknown',
    status,
    generated_at: pit.generatedAt || new Date().toISOString(),
    pit_json: pit
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/pit_results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`persistPIT: insert failed ${res.status}:`, detail);
      return null;
    }

    const rows = await res.json();
    const pitResultId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    console.log(`persistPIT: saved pit_results row id=${pitResultId} for submission ${submissionId}`);
    return pitResultId;
  } catch (err) {
    console.error('persistPIT: unexpected error:', err.message);
    return null;
  }
}

export async function fetchLatestPITForSubmission({
  supabaseUrl,
  supabaseKey,
  submissionId
}) {
  if (!supabaseUrl || !supabaseKey || !submissionId) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/pit_results?submission_id=eq.${encodeURIComponent(submissionId)}&order=generated_at.desc&limit=1&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`fetchLatestPITForSubmission failed ${res.status}:`, detail);
      return null;
    }

    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (err) {
    console.error('fetchLatestPITForSubmission unexpected error:', err.message);
    return null;
  }
}

export async function updateSubmissionPITMetadata({
  supabaseUrl,
  supabaseKey,
  submissionId,
  pitResultId
}) {
  if (!supabaseUrl || !supabaseKey || !submissionId || !pitResultId) return false;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/submissions?id=eq.${encodeURIComponent(submissionId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          latest_pit_result_id: pitResultId,
          pit_generated_at: new Date().toISOString()
        })
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`updateSubmissionPITMetadata failed ${res.status}:`, detail);
      return false;
    }

    return true;
  } catch (err) {
    console.error('updateSubmissionPITMetadata unexpected error:', err.message);
    return false;
  }
}

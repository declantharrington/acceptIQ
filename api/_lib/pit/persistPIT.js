// api/_lib/pit/persistPIT.js
// Persists a completed PIT object to the pit_results table.
//
// Called from api/generate-report.js immediately after buildPIT() returns,
// so the full intelligence object is permanently stored and available to
// every future module (AI Analyst, Dashboard, etc.) without re-running
// the PIT against the same source data.
//
// Design notes:
// - This is intentionally a fire-and-forget-safe helper: it logs but does NOT
//   throw if the insert fails, because a pit_results write failure should never
//   block the report module from completing. The report itself is the
//   customer-facing deliverable; the pit_results row is infrastructure.
// - It does NOT deduplicate (one submission can have multiple pit_results rows
//   if generate-report is called multiple times with different overrides).
//   The most recent row (ordered by generated_at DESC) is always "current".

export async function persistPIT({ supabaseUrl, supabaseKey, submissionId, merchantId, pit }) {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('persistPIT: missing Supabase config - skipping persist');
    return null;
  }
  if (!submissionId) {
    console.warn('persistPIT: missing submissionId - skipping persist');
    return null;
  }
  if (!pit || typeof pit !== 'object') {
    console.warn('persistPIT: invalid pit object - skipping persist');
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/pit_results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        submission_id: submissionId,
        merchant_id:   merchantId || null,
        pit_version:   pit.version || 'PIT v2',
        pit_json:      pit,
        generated_at:  pit.generatedAt || new Date().toISOString()
      })
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

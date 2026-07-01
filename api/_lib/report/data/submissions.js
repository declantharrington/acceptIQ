// api/_lib/report/data/submissions.js
// Supabase submission read/update helpers.

export async function fetchSubmissionById({ supabaseUrl, supabaseKey, submissionId }) {
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/submissions?id=eq.${encodeURIComponent(submissionId)}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  if (!fetchRes.ok) {
    const detail = await fetchRes.text();
    throw new Error(`Failed to fetch submission: ${fetchRes.status} ${detail}`);
  }

  const rows = await fetchRes.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

export async function updateSubmissionAfterReport({
  supabaseUrl,
  supabaseKey,
  submissionId,
  report,
  narrative,
  htmlPath,
  pitResultId = null
}) {
  const payload = {
    status: 'approved',
    report_narrative: JSON.stringify(narrative),
    report_html_path: htmlPath,
    report_json: JSON.stringify(report),
    provider: report.provider ?? null,
    period: report.period ?? null,
    volume: report.volume ?? null,
    total_fees: report.totalFees ?? null,
    effective_rate: report.effectiveRate ?? null,
    pricing_model: report.pricingModel ?? null,
    lcr_status: report.lcrStatus ?? null,
    chargeback_ratio: (report.chargebacks && report.chargebacks.ratio) ?? null
  };

  if (pitResultId) {
    payload.latest_pit_result_id = pitResultId;
    payload.pit_generated_at = new Date().toISOString();
  }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/submissions?id=eq.${encodeURIComponent(submissionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(payload)
    }
  );

  if (!updateRes.ok) {
    const detail = await updateRes.text();
    throw new Error(`Failed to update submission after report: ${updateRes.status} ${detail}`);
  }

  return true;
}

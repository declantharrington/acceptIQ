// api/_lib/report/data/submissions.js
// Supabase submission read/update helpers.

export async function fetchSubmissionById({ supabaseUrl, supabaseKey, submissionId }) {
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/submissions?id=eq.${submissionId}&select=*`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const rows = await fetchRes.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

export async function updateSubmissionAfterReport({ supabaseUrl, supabaseKey, submissionId, report, narrative, htmlPath }) {
  await fetch(`${supabaseUrl}/rest/v1/submissions?id=eq.${submissionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
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
    })
  });
}

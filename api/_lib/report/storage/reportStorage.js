// api/_lib/report/storage/reportStorage.js
// Supabase Storage upload helper for generated HTML reports.

import { safeStoragePart } from '../metrics/formatters.js';

export async function uploadReportHtml({ supabaseUrl, supabaseKey, html, companyName, provider }) {
  const timestamp = Date.now();
  const safeName = safeStoragePart(companyName, 'Unknown', 30);
  const safeProvider = safeStoragePart(provider, 'Unknown', 20);
  const htmlPath = `reports/${safeName}_${safeProvider}_${timestamp}.html`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/statements/${htmlPath}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'text/html',
      'x-upsert': 'true'
    },
    body: html
  });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    throw new Error(`Storage upload failed: ${uploadRes.status} ${detail}`);
  }

  return htmlPath;
}

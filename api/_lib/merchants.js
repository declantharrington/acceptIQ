// api/_lib/merchants.js
// Merchant entity helpers.
//
// A "merchant" is the real-world business behind one or more submissions.
// This module handles finding or creating merchant rows, and linking
// submissions to them.
//
// parseMerchantFromContext() mirrors the logic in public/admin/index.html's
// parseMerchant() function. If that function ever changes, update this too.

export function parseMerchantFromContext(programContext) {
  const ctx = programContext || '';
  const grab = re => {
    const m = ctx.match(re);
    return m && m[1] ? m[1].trim() : '';
  };

  const rawEmail = grab(/Email:\s*(.+)/);
  const email = rawEmail.replace(/\s*\(.*\)\s*$/, '').trim();

  return {
    companyName:  grab(/Company:\s*(.+)/),
    contactName:  grab(/Name:\s*(.+)/),
    contactEmail: email,
    contactPhone: grab(/Phone:\s*(.+)/),
    industry:     grab(/Industry:\s*(.+)/)
  };
}

export async function upsertMerchant({ supabaseUrl, supabaseKey, programContext }) {
  const { companyName, contactName, contactEmail, contactPhone, industry } =
    parseMerchantFromContext(programContext);

  if (!companyName || companyName.length > 120) {
    console.warn('upsertMerchant: no valid company name found in program_context - skipping');
    return null;
  }

  try {
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/merchants?company_name=eq.${encodeURIComponent(companyName)}${contactEmail ? `&contact_email=eq.${encodeURIComponent(contactEmail)}` : ''}&select=id&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );

    if (findRes.ok) {
      const existing = await findRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`upsertMerchant: found existing merchant id=${existing[0].id} for "${companyName}"`);
        return existing[0].id;
      }
    }

    const createRes = await fetch(`${supabaseUrl}/rest/v1/merchants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        company_name:  companyName,
        contact_name:  contactName  || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        industry:      industry     || null
      })
    });

    if (!createRes.ok) {
      const detail = await createRes.text();
      console.error(`upsertMerchant: create failed ${createRes.status}:`, detail);
      return null;
    }

    const rows = await createRes.json();
    const merchantId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    console.log(`upsertMerchant: created merchant id=${merchantId} for "${companyName}"`);
    return merchantId;
  } catch (err) {
    console.error('upsertMerchant: unexpected error:', err.message);
    return null;
  }
}

export async function linkSubmissionToMerchant({ supabaseUrl, supabaseKey, submissionId, merchantId }) {
  if (!merchantId) return;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/submissions?id=eq.${submissionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ merchant_id: merchantId })
      }
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error(`linkSubmissionToMerchant: failed ${res.status}:`, detail);
    }
  } catch (err) {
    console.error('linkSubmissionToMerchant: unexpected error:', err.message);
  }
}

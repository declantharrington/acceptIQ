// api/generate-report.js — TEMPORARY DIAGNOSTIC VERSION
// Purpose: isolate whether importing payments-knowledge-base.js is what's
// crashing the function at load time. This strips out everything else
// (Supabase, Anthropic, the HTML template) so if THIS still fails with the
// same FUNCTION_INVOCATION_FAILED / ~150ms / zero-outgoing-requests
// signature, the import itself is proven to be the problem.
//
// Once we have an answer, revert to the real generate-report.js.

import { PAYMENTS_KB } from './_lib/payments-knowledge-base.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    ok: true,
    kbLength: PAYMENTS_KB.length,
    kbFirst50: PAYMENTS_KB.slice(0, 50),
  });
}

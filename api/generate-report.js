// api/generate-report.js — DIAGNOSTIC 2
// Tests whether req.body is unexpectedly undefined/missing on Vercel for
// this route, which would crash the very first line of the real handler
// (`const { submissionId, overrides = {} } = req.body;`) BEFORE the
// try/catch block even starts — producing exactly the symptom we're seeing:
// instant failure, zero outgoing requests, generic Vercel error page.

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Wrap EVERYTHING in try/catch here, including the body access, so even
  // if something throws we get a real JSON answer instead of Vercel's
  // generic crash page.
  try {
    return res.status(200).json({
      ok: true,
      method: req.method,
      bodyType: typeof req.body,
      bodyIsNull: req.body === null,
      bodyIsUndefined: req.body === undefined,
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
      rawBodyPreview: typeof req.body === 'string' ? req.body.slice(0, 200) : null,
    });
  } catch (err) {
    return res.status(200).json({
      caughtError: true,
      message: err.message,
      stack: err.stack,
    });
  }
}

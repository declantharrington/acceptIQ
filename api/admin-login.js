// api/admin-login.js
// Issues a signed admin session cookie after checking the password against
// ADMIN_DASHBOARD_PASSWORD. No usernames, no database - one shared password
// for the admin dashboard, matching the single-operator scale of this tool
// today. See api/_lib/admin/session.js for the token mechanism, and
// api/admin-logout.js to clear it.

import { createSessionToken, checkAdminPassword, ADMIN_SESSION_COOKIE } from './_lib/admin/session.js';

// Basic in-memory rate limiting per Vercel function instance. This is not a
// substitute for a real rate limiter (instances are ephemeral and this
// resets on cold start), but it raises the cost of a naive brute-force
// script hitting a single warm instance repeatedly.
const attempts = new Map(); // ip -> { count, windowStart }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    console.warn(`admin-login: rate limited ip=${ip}`);
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const body = req.body || {};
  const { password } = body;

  let valid;
  try {
    valid = checkAdminPassword(password);
  } catch (err) {
    // ADMIN_DASHBOARD_PASSWORD not configured - this is a server
    // misconfiguration, not a wrong-password case. Fail closed.
    console.error('admin-login:', err.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!valid) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  let token;
  try {
    token = createSessionToken();
  } catch (err) {
    console.error('admin-login:', err.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // HttpOnly: JS on the page can't read the cookie (mitigates XSS token theft).
  // Secure: only sent over HTTPS (Vercel production is always HTTPS).
  // SameSite=Strict: not sent on cross-site requests at all.
  res.setHeader('Set-Cookie', [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${12 * 60 * 60}`
  ]);

  return res.status(200).json({ success: true });
}

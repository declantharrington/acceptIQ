// api/_lib/admin/session.js
// Minimal session mechanism for the admin dashboard.
//
// Design: a signed, time-limited token, no session database needed.
// Token format: "<expiryEpochMs>.<hexHmacSignature>"
// The HMAC is computed over the expiry using ADMIN_SESSION_SECRET, so a
// token can't be forged or its expiry extended without knowing the secret.
//
// This deliberately does NOT store per-user identity - there is one admin
// password, shared by whoever has it. If you need per-person accounts later,
// this is the place to extend (swap for real auth, e.g. Supabase Auth).

import crypto from 'crypto';

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_SESSION_COOKIE = 'aiq_admin_session';

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET is not set (or is too short). Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'and add it to Vercel\'s environment variables.'
    );
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

// Constant-time string compare to avoid timing side-channels on the
// signature check and the password check.
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken() {
  const expiry = String(Date.now() + SESSION_DURATION_MS);
  const signature = sign(expiry);
  return `${expiry}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature) return false;
  if (!timingSafeEqual(sign(expiry), signature)) return false;
  if (Date.now() > Number(expiry)) return false;
  return true;
}

export function checkAdminPassword(submittedPassword) {
  const correctPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!correctPassword) {
    throw new Error('ADMIN_DASHBOARD_PASSWORD is not set in the environment.');
  }
  if (!submittedPassword) return false;
  return timingSafeEqual(submittedPassword, correctPassword);
}

// Parses the session cookie out of a raw Cookie header string.
export function getSessionTokenFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Returns true if the request carries a valid, unexpired admin session.
// Use this as the first line of every admin-only API handler.
export function isAuthorizedAdminRequest(req) {
  const token = getSessionTokenFromCookieHeader(req.headers.cookie);
  return verifySessionToken(token);
}

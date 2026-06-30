// api/admin-logout.js
// Clears the admin session cookie.

import { ADMIN_SESSION_COOKIE } from './_lib/admin/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Setting Max-Age=0 tells the browser to delete the cookie immediately.
  res.setHeader('Set-Cookie', [
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  ]);

  return res.status(200).json({ success: true });
}

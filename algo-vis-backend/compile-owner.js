const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const COOKIE_NAME = 'asm_compile_session';
const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').flatMap(part => {
    const separator = part.indexOf('=');
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      return [[name, decodeURIComponent(value)]];
    } catch {
      return [];
    }
  }));
}

function signSession(sessionId, secret) {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

function verifySignedSession(value, secret) {
  const separator = String(value || '').indexOf('.');
  if (separator < 1) return '';
  const sessionId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!SESSION_PATTERN.test(sessionId) || !signature) return '';

  const expected = Buffer.from(signSession(sessionId, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return '';
  return sessionId;
}

function appendSetCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  const cookies = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  res.setHeader('Set-Cookie', [...cookies, value]);
}

/**
 * Resolve the fairness identity used by the compile queue.
 * Authenticated users share one queue identity across devices. Anonymous users
 * receive a server-signed HttpOnly cookie so a school NAT does not collapse
 * everyone into the same queue owner and clients cannot mint queue identities.
 */
function resolveCompileOwner(req, res, { secret, verifyBearer }) {
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && typeof verifyBearer === 'function') {
    try {
      const payload = verifyBearer(bearer);
      if (payload?.id) return `user:${payload.id}`;
    } catch {
      // An invalid optional login token must not block anonymous compilation.
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  let sessionId = verifySignedSession(cookies[COOKIE_NAME], secret);
  if (!sessionId) {
    sessionId = randomUUID();
    const signed = `${sessionId}.${signSession(sessionId, secret)}`;
    const secure = req.secure ? '; Secure' : '';
    appendSetCookie(
      res,
      `${COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`
    );
  }
  return `session:${sessionId}`;
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  resolveCompileOwner,
  signSession,
  verifySignedSession,
};

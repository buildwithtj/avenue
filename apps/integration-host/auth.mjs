// Member identity for the API comes ONLY from a validated Entra ID token, never from a request field. Fail closed.
// `verifyJwt(token)` is injected by the host (signature check against the tenant's keys) and returns the claims or throws.
export async function authenticate(headers, { verifyJwt, audience, tenantId, nowSec }) {
  const h = headers?.authorization || headers?.Authorization || '';
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(h);
  if (!m) throw new HttpError(401, 'sign-in required');
  let c;
  try { c = await verifyJwt(m[1]); } catch { throw new HttpError(401, 'invalid token'); }
  if (!c || c.aud !== audience || c.tid !== tenantId) throw new HttpError(403, 'wrong audience or tenant');
  if (typeof c.exp !== 'number' || c.exp <= nowSec) throw new HttpError(401, 'token expired');
  const email = String(c.preferred_username || c.upn || c.email || '').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new HttpError(403, 'no e-mail on token');
  return { email, oid: c.oid };
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// RS256 token signature check for Entra ID tokens. `getKey(kid)` is injected and returns the tenant's public JWK (cached JWKS fetch in the host).
// Only RS256 is accepted ("none" and HS256 are refused). Claims (aud, tid, exp) are checked afterwards by auth.mjs.
import { createPublicKey, createVerify } from 'node:crypto';

const b64 = (s) => Buffer.from(s, 'base64url');

export function createVerifyJwt(getKey) {
  return async function verifyJwt(token) {
    const parts = String(token).split('.');
    if (parts.length !== 3) throw new Error('jwt: malformed');
    const header = JSON.parse(b64(parts[0]).toString('utf8'));
    if (header.alg !== 'RS256' || !header.kid) throw new Error('jwt: unsupported algorithm');
    const jwk = await getKey(header.kid);
    if (!jwk) throw new Error('jwt: unknown key');
    const ok = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey({ key: jwk, format: 'jwk' }), b64(parts[2]));
    if (!ok) throw new Error('jwt: bad signature');
    return JSON.parse(b64(parts[1]).toString('utf8'));
  };
}

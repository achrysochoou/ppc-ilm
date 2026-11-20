import { createPublicKey, verify } from 'node:crypto';

export class AuthenticationError extends Error {}
export class IdentityProviderError extends Error {}

async function boundedJson(response) {
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 262144) throw new Error('Identity provider response too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createKeycloakAuth({ issuer = process.env.KEYCLOAK_ISSUER, audience = process.env.ILM_AUDIENCE || 'ilm-api', jwksUrl = process.env.KEYCLOAK_JWKS_URL || (issuer ? `${issuer}/protocol/openid-connect/certs` : undefined), fetcher = fetch, now = () => Date.now(), cacheMs = 300000 } = {}) {
  if (!issuer || !audience || !jwksUrl) throw new Error('KEYCLOAK_ISSUER and ILM_AUDIENCE must be configured');
  for (const endpoint of [issuer, jwksUrl]) {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error('Invalid Keycloak endpoint configuration');
  }
  let keys = [], expiresAt = 0, pending, lastRefresh = -Infinity;
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      lastRefresh = now();
      try {
        const response = await fetcher(jwksUrl, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!response.ok) throw new Error();
        const body = await boundedJson(response);
        if (!Array.isArray(body.keys) || body.keys.length > 100) throw new Error();
        const next = body.keys.filter(k => k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256') && (!k.key_ops || k.key_ops.includes('verify'))).map(k => ({ kid: k.kid, key: createPublicKey({ key: k, format: 'jwk' }) }));
        if (!next.length) throw new Error();
        keys = next; expiresAt = now() + cacheMs;
      } catch { throw new IdentityProviderError('Identity provider unavailable'); }
    })();
    try { await pending; } finally { pending = undefined; }
  }
  return async function authenticate(header) {
    if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9_.-]+$/i.test(header) || header.length > 16384) throw new AuthenticationError('Invalid bearer token');
    const token = header.slice(7), parts = token.split('.');
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new AuthenticationError('Invalid bearer token');
    let protectedHeader, claims;
    try {
      protectedHeader = JSON.parse(Buffer.from(parts[0], 'base64url'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    } catch { throw new AuthenticationError('Invalid bearer token'); }
    if (!protectedHeader || protectedHeader.alg !== 'RS256' || typeof protectedHeader.kid !== 'string' || protectedHeader.crit !== undefined || !claims || typeof claims !== 'object' || Array.isArray(claims)) throw new AuthenticationError('Invalid bearer token');
    if (now() >= expiresAt) {
      if (now() - lastRefresh < 1000 && !pending) throw new IdentityProviderError('Identity provider unavailable');
      await refresh();
    }
    let key = keys.find(k => k.kid === protectedHeader.kid);
    // Refresh once for a new signing key, rate-limited against random-kid floods.
    if (!key && now() - lastRefresh >= 1000) { await refresh(); key = keys.find(k => k.kid === protectedHeader.kid); }
    if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key.key, Buffer.from(parts[2], 'base64url'))) throw new AuthenticationError('Invalid bearer token');
    const seconds = now() / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audiences.includes(audience) || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= seconds || typeof claims.sub !== 'string' || !claims.sub || (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf > seconds)) || (claims.iat !== undefined && (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > seconds))) throw new AuthenticationError('Invalid bearer token');
    const roles = claims.resource_access?.[audience]?.roles;
    return { roles: new Set(Array.isArray(roles) ? roles.filter(r => typeof r === 'string') : []) };
  };
}

export async function getServiceToken({ issuer = process.env.KEYCLOAK_ISSUER, clientId = process.env.ILM_PILOT_CLIENT_ID || 'ilm-pilot', clientSecret = process.env.ILM_PILOT_CLIENT_SECRET } = {}) {
  if (!issuer || !clientSecret) throw new Error('Configure KEYCLOAK_ISSUER and ILM_PILOT_CLIENT_SECRET; start Keycloak before running the pilot');
  try {
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
    });
    if (!response.ok) throw new Error();
    const body = await boundedJson(response);
    if (typeof body.access_token !== 'string' || body.token_type?.toLowerCase() !== 'bearer') throw new Error();
    return body.access_token;
  } catch { throw new Error('Could not obtain a Keycloak service token; verify Keycloak readiness, realm import and service-account credentials'); }
}

import http from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AuthenticationError } from '../ilm/auth.js';

export function stubAuth(token) {
  return async header => {
    if (header !== `Bearer ${token}`) throw new AuthenticationError();
    return { roles: new Set(['ilm-submit', 'ilm-read', 'ilm-audit-read']) };
  };
}

// Only used by isolated tests. Production and npm run pilot use Keycloak.
export async function startIssuer() {
  let pair = generateKeyPairSync('rsa', { modulusLength: 2048 }), kid = 'test-key-1';
  let issuer, jwksRequests = 0, unavailable = false;
  const secret = 'test-client-secret-not-for-production';
  const issue = (claims = {}, header = {}) => {
    const seconds = Math.floor(Date.now() / 1000);
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid, ...header })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ iss: issuer, aud: 'ilm-api', sub: 'fixture-service-account', typ: 'Bearer', iat: seconds, exp: seconds + 300, resource_access: { 'ilm-api': { roles: ['ilm-submit', 'ilm-read', 'ilm-audit-read'] } }, ...claims })).toString('base64url');
    return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), pair.privateKey).toString('base64url')}`;
  };
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url.endsWith('/certs')) {
      jwksRequests++;
      if (unavailable) return send(503, {});
      return send(200, { keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' }] });
    }
    if (req.url.endsWith('/token')) {
      let body = ''; for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      if (form.get('client_id') !== 'ilm-pilot' || form.get('client_secret') !== secret || form.get('grant_type') !== 'client_credentials') return send(401, { error: 'invalid_client' });
      return send(200, { access_token: issue(), token_type: 'Bearer', expires_in: 300 });
    }
    send(404, {});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${server.address().port}/realms/test`;
  return {
    issuer, secret, issue,
    rotate() { pair = generateKeyPairSync('rsa', { modulusLength: 2048 }); kid = 'test-key-2'; },
    unavailable(value) { unavailable = value; },
    requests: () => jwksRequests,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

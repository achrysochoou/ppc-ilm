import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeycloakAuth, getServiceToken, AuthenticationError, IdentityProviderError } from '../ilm/auth.js';
import { createServer } from '../ilm/server.js';
import { Store } from '../ilm/store.js';
import { startIssuer } from '../test-support/oidc.js';

test('signed token validation, expiry, issuer, audience, algorithm, tampering and key rotation', async () => {
  const provider = await startIssuer();
  let clock = Date.now();
  const auth = createKeycloakAuth({ issuer: provider.issuer, now: () => clock });
  try {
    const token = await getServiceToken({ issuer: provider.issuer, clientSecret: provider.secret });
    assert.ok((await auth(`Bearer ${token}`)).roles.has('ilm-submit'));
    await auth(`Bearer ${token}`); assert.equal(provider.requests(), 1);
    for (const claims of [{ iss: 'https://wrong-issuer.test' }, { aud: 'other-service' }, { exp: 0 }, { exp: '999999999999' }, { nbf: Math.floor(clock / 1000) + 600 }, { iat: Math.floor(clock / 1000) + 600 }, { sub: '' }]) {
      await assert.rejects(() => auth(`Bearer ${provider.issue(claims)}`), AuthenticationError);
    }
    for (const header of [{ alg: 'none' }, { alg: 'HS256' }, { kid: 'unknown' }, { crit: ['unrecognized'] }]) await assert.rejects(() => auth(`Bearer ${provider.issue({}, header)}`), AuthenticationError);
    const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ iss: provider.issuer, exp: 999999999999, aud: 'ilm-api' })).toString('base64url');
    await assert.rejects(() => auth(`Bearer ${parts.join('.')}`), AuthenticationError);
    await assert.rejects(() => auth('Bearer static-old-token'), AuthenticationError);
    await assert.rejects(() => getServiceToken({ issuer: provider.issuer, clientSecret: 'incorrect' }), /Could not obtain/);
    provider.rotate(); clock += 1100;
    await auth(`Bearer ${provider.issue()}`); assert.equal(provider.requests(), 2);
    provider.unavailable(true); clock += 300001;
    await assert.rejects(() => auth(`Bearer ${provider.issue()}`), IdentityProviderError);
  } finally { await provider.close(); }
});

test('API enforces independent submit, read and audit roles and keeps health public', async () => {
  const provider = await startIssuer(), store = new Store(':memory:');
  const entries = [];
  const server = createServer({ store, authenticate: createKeycloakAuth({ issuer: provider.issuer }), logger: { log(e) { entries.push(e); } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoints = [
    ['POST', '/api/v1/identity-lifecycle/cases/batch', 'ilm-submit', 400],
    ['GET', '/api/v1/identity-lifecycle/batches/missing', 'ilm-read', 404],
    ['GET', '/api/v1/identity-lifecycle/batches/missing/audit', 'ilm-audit-read', 404]
  ];
  try {
    assert.equal((await fetch(base + '/health/ready')).status, 200);
    for (const [method, path, role, allowedStatus] of endpoints) {
      assert.equal((await fetch(base + path, { method })).status, 401);
      for (const granted of ['ilm-submit', 'ilm-read', 'ilm-audit-read', 'none']) {
        const token = provider.issue({ resource_access: { 'ilm-api': { roles: [granted] } } });
        const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
        assert.equal(response.status, granted === role ? allowedStatus : 403, `${role} versus ${granted}`);
        assert.equal(JSON.stringify(entries).includes(token), false);
      }
    }
    const otherClient = provider.issue({ resource_access: { other: { roles: ['ilm-submit'] } }, realm_access: { roles: ['ilm-submit'] } });
    assert.equal((await fetch(base + endpoints[0][1], { method: 'POST', headers: { Authorization: `Bearer ${otherClient}` } })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); await provider.close(); }
});

test('provider outages fail closed with 503 without exposing provider errors', async () => {
  const provider = await startIssuer(); provider.unavailable(true);
  const store = new Store(':memory:');
  const server = createServer({ store, authenticate: createKeycloakAuth({ issuer: provider.issuer }), logger: { log() {} } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/identity-lifecycle/batches/test`, { headers: { Authorization: `Bearer ${provider.issue()}` } });
    assert.equal(response.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); await provider.close(); }
});

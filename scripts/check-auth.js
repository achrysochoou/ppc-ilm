import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getServiceToken, createKeycloakAuth } from '../ilm/auth.js';

const token = await getServiceToken();
const principal = await createKeycloakAuth()(`Bearer ${token}`);
for (const role of ['ilm-submit', 'ilm-read', 'ilm-audit-read']) assert.ok(principal.roles.has(role), `Pilot account is missing ${role}`);
const base = process.env.ILM_BASE_URL || 'http://127.0.0.1:8000';
const id = `auth-check-${randomUUID()}`;
const checks = [
  { method: 'GET', path: '/health/ready', expected: 200 },
  { method: 'GET', path: `/api/v1/identity-lifecycle/batches/${id}`, expected: 401 },
  { method: 'GET', path: `/api/v1/identity-lifecycle/batches/${id}`, bearer: 'retired-static-token', expected: 401 },
  { method: 'GET', path: `/api/v1/identity-lifecycle/batches/${id}`, bearer: token, expected: 404 },
  { method: 'GET', path: `/api/v1/identity-lifecycle/batches/${id}/audit`, bearer: token, expected: 404 },
  { method: 'POST', path: '/api/v1/identity-lifecycle/cases/batch', bearer: token, body: '{}', expected: 400 }
];
for (const check of checks) {
  const response = await fetch(base + check.path, {
    method: check.method, signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...(check.bearer ? { Authorization: `Bearer ${check.bearer}` } : {}) },
    ...(check.body ? { body: check.body } : {})
  });
  await response.arrayBuffer();
  assert.equal(response.status, check.expected, `${check.method} ${check.path}`);
  console.log(JSON.stringify({ check: 'keycloak_authorization', method: check.method, expected_status: check.expected, status: response.status, passed: true }));
}
console.log('Keycloak client credentials, token validation and deployed API permissions verified. No cases were stored.');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, stripLabels } from '../ilm/engine.js';
import { Store, Conflict } from '../ilm/store.js';
import { createServer } from '../ilm/server.js';
import { PilotTargets } from '../ilm/simulator.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dataset = JSON.parse(readFileSync(new URL('../data/RECITALS_PPC_PoC_Package/recitals_scenario1_compact_normalized_dataset.json', import.meta.url)));
test('results and audit survive a database reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ilm-test-')), path = join(directory, 'test.sqlite');
  let store = new Store(path);
  try {
    const first = store.submit(dataset, { mode: 'plan' }); store.close(); store = new Store(path);
    assert.deepEqual(store.submit(dataset, { mode: 'plan' }), first);
    assert.equal(store.audit(dataset.batch_id).length, 12);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('leaver evidence outside the revocation SLA is flagged', () => {
  const c = structuredClone(dataset.items[4]); c.execution_evidence[0].observed_at = '2026-08-15T16:00:00Z';
  assert.equal(evaluate(c, { mode: 'replay' }).final_state, 'sla_breached');
});
test('simulation executes changes and compensates partial failure', () => {
  const targets = new PilotTargets(), options = { asOf: '2027-01-02T00:00:00Z' };
  const join = dataset.items[0];
  assert.equal(targets.execute(join.subject, evaluate(join, options)).final_state, 'simulated_completed');
  assert.equal(targets.identities.get(join.subject.person_id).access.length, 3);
  const mover = dataset.items[2]; targets.seed(mover.subject, mover.current_access); targets.execute(mover.subject, evaluate(mover, options));
  assert.equal(targets.identities.get(mover.subject.person_id).access.includes('sap:role:FI_DISPLAY'), false);
  const failure = dataset.items[5];
  assert.equal(targets.execute(failure.subject, evaluate(failure, options), { failAt: 1 }).rollback_verified, true);
  assert.equal(targets.identities.has(failure.subject.person_id), false);
  const contractor = dataset.items[1]; targets.execute(contractor.subject, evaluate(contractor, options)); targets.expire('2027-01-01T00:00:00Z');
  assert.deepEqual(targets.identities.get(contractor.subject.person_id).access, []);
  const leaver = dataset.items[4]; targets.seed(leaver.subject, leaver.current_access); targets.execute(leaver.subject, evaluate(leaver, options));
  assert.equal(targets.identities.get(leaver.subject.person_id).enabled, false);
  assert.equal(targets.identities.get(leaver.subject.person_id).sessions, 0);
  const security = dataset.items[7]; assert.equal(targets.execute(security.subject, evaluate(security, options)).executed, false);
});
for (const c of dataset.items) test(c.case_id, () => {
  const actual = evaluate(stripLabels(c), { mode: 'replay' });
  assert.equal(actual.decision, c.expected_recitals.decision);
  assert.equal(actual.final_state, c.expected_recitals.final_state);
  assert.equal(actual.automatic_execution, false);
});
test('labels and supplied policy conclusions cannot change decisions', () => {
  const c = structuredClone(dataset.items[3]);
  c.expected_recitals = { decision: 'approve_and_provision' }; c.policy_evaluation = { result: 'allow' };
  assert.equal(evaluate(c).decision, 'deny_and_notify');
});
test('source, approval, expiry, PIM and scheduling are enforced', () => {
  let c = structuredClone(dataset.items[0]); c.authoritative_event.source = 'attacker';
  assert.equal(evaluate(c).final_state, 'input_invalid');
  c = structuredClone(dataset.items[0]); c.access_request.approval.status = 'pending';
  assert.equal(evaluate(c).decision, 'hold_for_approval');
  c = structuredClone(dataset.items[1]); c.access_request.requested_expiration = '2028-01-01T00:00:00Z';
  assert.equal(evaluate(c).final_state, 'input_invalid');
  c = structuredClone(dataset.items[10]); c.access_request.requested_entitlements = ['entra:role:Global Administrator'];
  assert.equal(evaluate(c).final_state, 'policy_blocked');
  assert.equal(evaluate(dataset.items[0], { asOf: '2026-01-01T00:00:00Z' }).final_state, 'scheduled');
});
test('batch atomicity, durable idempotency and conflict detection', () => {
  const store = new Store(':memory:');
  try {
    const options = { mode: 'plan' }, result = store.submit(dataset, options);
    assert.deepEqual(store.submit(dataset, options), result);
    assert.equal(store.audit(dataset.batch_id).length, 12);
    const changed = structuredClone(dataset); changed.items[0].subject.upn = 'changed@example.test';
    assert.throws(() => store.submit(changed, options), Conflict);
    const invalid = structuredClone(dataset); invalid.batch_id = 'invalid'; invalid.items[1].case_id = invalid.items[0].case_id;
    assert.throws(() => store.submit(invalid, options)); assert.equal(store.get('invalid'), null);
  } finally { store.close(); }
});
test('API authentication, replay boundary, input errors and retrieval', async () => {
  const store = new Store(':memory:'), token = 'test-token-with-at-least-24-characters';
  const server = createServer({ store, token, allowReplay: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, path = '/api/v1/identity-lifecycle/cases/batch';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': dataset.batch_id };
  try {
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 401);
    assert.equal((await fetch(base + path + '?mode=replay', { method: 'POST', headers, body: JSON.stringify(dataset) })).status, 403);
    assert.equal((await fetch(base + path, { method: 'POST', headers, body: '{' })).status, 400);
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(dataset) });
    assert.equal(response.status, 200); assert.equal((await response.json()).items.length, 12);
    assert.equal((await fetch(base + '/api/v1/identity-lifecycle/batches/' + dataset.batch_id, { headers })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

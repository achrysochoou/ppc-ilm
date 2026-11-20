import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createLogger, requestId } from '../ilm/logging.js';
import { createServer } from '../ilm/server.js';
import { Store } from '../ilm/store.js';
import { stubAuth } from '../test-support/oidc.js';

test('bounded queue reports dropped records after the collector catches up', async () => {
  const lines = [], callbacks = [];
  const logger = createLogger({ maxQueueBytes: 1024, sink: { write(line, done) { lines.push(JSON.parse(line)); callbacks.push(done); } } });
  for (let i = 0; i < 1000; i++) logger.log({ level: 'info', event: 'test', value: 'x'.repeat(100) });
  assert.ok(logger.stats().queued_bytes <= 1024);
  assert.ok(logger.stats().dropped_pending > 0);
  const flushed = logger.flush();
  while (callbacks.length) { callbacks.shift()(); await new Promise(resolve => setImmediate(resolve)); }
  await flushed;
  assert.equal(lines.filter(x => x.event === 'logging.dropped').length, 1);
  assert.equal(lines.reduce((n, x) => n + (x.event === 'logging.dropped' ? x.count : 1), 0), 1000);
  await logger.close();
});

test('sink failures are counted and do not crash requests or hang flushing', async () => {
  const sink = new Writable({ write(chunk, encoding, done) { done(new Error('collector unavailable')); } });
  const logger = createLogger({ sink, onError() {} });
  logger.log({ event: 'test' }); await logger.flush();
  assert.equal(logger.stats().write_failures, 1);
  await logger.close();
});

test('request IDs reject unsafe input', () => {
  assert.equal(requestId('pilot-request-12'), 'pilot-request-12');
  assert.match(requestId('bad\nheader'), /^[a-f0-9-]{36}$/);
  assert.notEqual(requestId('x'.repeat(65)), 'x'.repeat(65));
});

test('HTTP logging correlates responses, excludes secrets and handles concurrent requests', async () => {
  const lines = [];
  const sink = new Writable({ write(chunk, encoding, done) { lines.push(JSON.parse(chunk.toString())); done(); } });
  const logger = createLogger({ sink }), store = new Store(':memory:'), token = 'private-api-token-never-log-this';
  const server = createServer({ store, authenticate: stubAuth(token), logger });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-ID': 'pilot-request-12', 'Idempotency-Key': 'private-batch-id' };
  try {
    await fetch(base + '/health/ready');
    const body = { batch_id: 'private-batch-id', password: 'secret-password', items: [], subject: { upn: 'private-person@example.test' } };
    const response = await fetch(base + '/api/v1/identity-lifecycle/cases/batch?secret=private-query', { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.headers.get('x-request-id'), 'pilot-request-12');
    assert.equal(response.status, 400);
    await fetch(base + '/api/v1/identity-lifecycle/batches/private-path-id', { headers });
    await fetch(base + '/api/v1/identity-lifecycle/cases/batch', { method: 'POST', headers, body: '{ secret-malformed-body' });
    await Promise.all(Array.from({ length: 50 }, (_, i) => fetch(base + '/missing', { headers: { 'X-Request-ID': `concurrent-${i}` } })));
    await logger.flush();
    const serialized = JSON.stringify(lines);
    for (const secret of [token, 'secret-password', 'private-person@example.test', 'private-query', 'private-path-id', 'private-batch-id', 'secret-malformed-body']) assert.equal(serialized.includes(secret), false, secret);
    assert.equal(lines.some(x => x.route === '/health/ready'), false);
    const entry = lines.find(x => x.event === 'http.response' && x.request_id === 'pilot-request-12' && x.request);
    assert.equal(entry.status, 400); assert.equal(entry.request.case_count, 0);
    assert.equal(entry.request.batch_ref.length, 64);
    assert.ok(entry.request_bytes > 0); assert.ok(entry.response_bytes > 0); assert.ok(entry.duration_ms >= 0);
    for (let i = 0; i < 50; i++) {
      assert.equal(lines.filter(x => x.request_id === `concurrent-${i}` && x.event === 'http.response').length, 1);
    }
  } finally { await new Promise(resolve => server.close(resolve)); await logger.close(); store.close(); }
});

test('logging failures cannot prevent a response', async () => {
  const store = new Store(':memory:');
  const server = createServer({ store, authenticate: stubAuth('test-token-long-enough-for-api'), logger: { log() { throw new Error('bad collector'); } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/missing`)).status, 401); }
  finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

test('storage errors return correlated metadata without logging error content', async () => {
  const entries = [], token = 'test-token-long-enough-for-api';
  const server = createServer({ authenticate: stubAuth(token), store: { get() { throw Object.assign(new Error('private storage detail'), { code: 'SQLITE_ERROR' }); } }, logger: { log(entry) { entries.push(entry); } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/identity-lifecycle/batches/test`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 500);
    assert.equal(entries.find(x => x.event === 'storage.failure').request_id, response.headers.get('x-request-id'));
    assert.equal(JSON.stringify(entries).includes('private storage detail'), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

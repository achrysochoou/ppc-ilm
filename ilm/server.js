import http from 'node:http';
import { createKeycloakAuth, IdentityProviderError } from './auth.js';
import { Store, Conflict } from './store.js';
import { timestamp } from './engine.js';
import { createLogger, requestId, batchSummary, responseSummary } from './logging.js';
export function createServer({ store = new Store(process.env.ILM_DB), authenticate = createKeycloakAuth(), allowReplay = process.env.ILM_ALLOW_REPLAY === 'true', logger = createLogger(), logHealth = process.env.ILM_LOG_HEALTH === 'true' } = {}) {
  return http.createServer(async (req, res) => {
    const id = requestId(req.headers['x-request-id']), started = performance.now();
    let requestBytes = 0, responseBytes = 0, requestSummary, replySummary, route = 'unmatched', finished = false;
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
    res.setHeader('X-Request-ID', id);
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch {}
    const quiet = !logHealth && url?.pathname === '/health/ready' && req.method === 'GET';
    const log = entry => { try { logger.log({ request_id: id, ...entry }); } catch {} };
    if (!quiet) log({ level: 'info', event: 'http.request', method });
    const complete = aborted => {
      if (finished) return;
      finished = true;
      if (quiet && !aborted && res.statusCode < 400) return;
      log({ level: aborted || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', event: aborted ? 'http.aborted' : 'http.response', method, route, status: aborted ? null : res.statusCode, duration_ms: Math.round((performance.now() - started) * 1000) / 1000, request_bytes: requestBytes, response_bytes: responseBytes, request: requestSummary, response: replySummary });
    };
    res.once('finish', () => complete(false));
    res.once('close', () => complete(!res.writableFinished));
    const send = (status, body) => {
      const serialized = JSON.stringify(body);
      responseBytes = Buffer.byteLength(serialized); replySummary = responseSummary(body);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(serialized);
    };
    if (!url) return send(400, { error: 'Invalid request URL' });
    if (url.pathname === '/health/ready') route = '/health/ready';
    if (url.pathname === '/api/v1/identity-lifecycle/cases/batch') route = '/api/v1/identity-lifecycle/cases/batch';
    if (req.method === 'GET' && url.pathname === '/health/ready') return send(200, { status: 'ready' });
    let principal;
    try { principal = await authenticate(req.headers.authorization); }
    catch (error) {
      if (error instanceof IdentityProviderError) return send(503, { error: 'Identity provider unavailable' });
      res.setHeader('WWW-Authenticate', 'Bearer');
      return send(401, { error: 'Unauthorized' });
    }
    try {
      const match = url.pathname.match(/^\/api\/v1\/identity-lifecycle\/batches\/([^/]+)(\/audit)?$/);
      if (match) route = '/api/v1/identity-lifecycle/batches/:batch_id' + (match[2] ? '/audit' : '');
      if (req.method === 'GET' && match) {
        if (!principal.roles.has(match[2] ? 'ilm-audit-read' : 'ilm-read')) return send(403, { error: 'Forbidden' });
        const id = decodeURIComponent(match[1]), batch = store.get(id);
        return send(batch ? 200 : 404, batch ? (match[2] ? store.audit(id) : batch) : { error: 'Batch not found' });
      }
      if (req.method !== 'POST' || url.pathname !== '/api/v1/identity-lifecycle/cases/batch') return send(404, { error: 'Not found' });
      if (!principal.roles.has('ilm-submit')) return send(403, { error: 'Forbidden' });
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'Use application/json' });
      let size = 0, chunks = [];
      for await (const chunk of req) { size += chunk.length; requestBytes += chunk.length; if (size > 1024 * 1024) { send(413, { error: 'Maximum body size is 1 MiB' }); return; } chunks.push(chunk); }
      const batch = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requestSummary = batchSummary(batch);
      if (req.headers['idempotency-key'] !== batch.batch_id) return send(400, { error: 'Idempotency-Key must equal batch_id' });
      const mode = url.searchParams.get('mode') || 'plan';
      if (!['plan', 'replay'].includes(mode)) return send(400, { error: 'mode must be plan or replay' });
      if (mode === 'replay' && (!allowReplay || batch.synthetic !== true)) return send(403, { error: 'Replay requires synthetic=true and ILM_ALLOW_REPLAY=true' });
      const asOf = url.searchParams.get('as_of');
      if (asOf) timestamp(asOf);
      return send(200, store.submit(batch, { mode, ...(asOf ? { asOf } : {}) }));
    } catch (e) {
      if (e instanceof Conflict) return send(409, { error: e.message });
      if (e instanceof SyntaxError || !(e.code)) return send(400, { error: e.message });
      log({ level: 'error', event: 'storage.failure' });
      return send(500, { error: 'Internal storage failure' });
    }
  });
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/ilm/server.js')) {
  const logger = createLogger();
  const server = createServer({ logger });
  server.requestTimeout = 15000;
  server.listen(Number(process.env.PORT || 8000), process.env.ILM_HOST || '127.0.0.1', () => logger.log({ level: 'info', event: 'server.started', port: server.address().port }));
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { logger.log({ level: 'info', event: 'server.stopped' }); await logger.close(); clearTimeout(deadline); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

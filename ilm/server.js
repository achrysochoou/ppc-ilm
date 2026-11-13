import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Store, Conflict } from './store.js';
import { timestamp } from './engine.js';
export function createServer({ store = new Store(process.env.ILM_DB), token = process.env.ILM_API_TOKEN, allowReplay = process.env.ILM_ALLOW_REPLAY === 'true' } = {}) {
  if (!token || token.length < 24) throw new Error('Set ILM_API_TOKEN to at least 24 random characters');
  return http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health/ready') return send(200, { status: 'ready' });
    const supplied = Buffer.from(req.headers.authorization || ''), expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Unauthorized' });
    try {
      const match = url.pathname.match(/^\/api\/v1\/identity-lifecycle\/batches\/([^/]+)(\/audit)?$/);
      if (req.method === 'GET' && match) {
        const id = decodeURIComponent(match[1]), batch = store.get(id);
        return send(batch ? 200 : 404, batch ? (match[2] ? store.audit(id) : batch) : { error: 'Batch not found' });
      }
      if (req.method !== 'POST' || url.pathname !== '/api/v1/identity-lifecycle/cases/batch') return send(404, { error: 'Not found' });
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'Use application/json' });
      let size = 0, chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) { send(413, { error: 'Maximum body size is 1 MiB' }); return; } chunks.push(chunk); }
      const batch = JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
      console.error('ILM storage failure', e.code);
      return send(500, { error: 'Internal storage failure' });
    }
  });
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/ilm/server.js')) {
  const server = createServer();
  server.requestTimeout = 15000;
  server.listen(Number(process.env.PORT || 8000), process.env.ILM_HOST || '127.0.0.1', () => console.log('ILM pilot API listening'));
}

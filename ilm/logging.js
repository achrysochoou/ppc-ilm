import { createHash, randomUUID } from 'node:crypto';

export function requestId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : randomUUID();
}

export function batchSummary(body) {
  if (!body || typeof body !== 'object') return undefined;
  return {
    // Correlate batches without placing caller-controlled identifiers in logs.
    ...(typeof body.batch_id === 'string' ? { batch_ref: createHash('sha256').update(body.batch_id).digest('hex') } : {}),
    ...(Array.isArray(body.items) ? { case_count: body.items.length } : {})
  };
}

export function responseSummary(body) {
  if (!body || typeof body !== 'object') return undefined;
  return {
    ...batchSummary(body),
    ...(Array.isArray(body) ? { record_count: body.length } : {}),
    ...(body.error ? { error: true } : {})
  };
}

// One bounded, asynchronous writer for the process. A slow collector must not
// accumulate unlimited memory or hold identity requests open. Payloads, headers,
// query strings, tokens and identity attributes never enter this writer.
export function createLogger({ sink = process.stdout, maxQueueBytes = Number(process.env.ILM_LOG_QUEUE_BYTES || 1048576), onError = () => { process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), service: 'ilm', level: 'error', event: 'logging.sink_error' }) + '\n'); } } = {}) {
  if (!Number.isSafeInteger(maxQueueBytes) || maxQueueBytes < 1024 || maxQueueBytes > 67108864) throw new Error('ILM_LOG_QUEUE_BYTES must be between 1024 and 67108864');
  let queue = [], queuedBytes = 0, writing = false, dropped = 0, failures = 0, lastErrorAt = -Infinity;
  const waiters = [];
  const encode = entry => JSON.stringify({ timestamp: new Date().toISOString(), service: 'ilm', ...entry }) + '\n';
  function pump() {
    if (writing) return;
    if (!queue.length && dropped) {
      const line = encode({ level: 'warn', event: 'logging.dropped', count: dropped });
      dropped = 0; queue.push(line); queuedBytes += Buffer.byteLength(line);
    }
    if (!queue.length) { for (const resolve of waiters.splice(0)) resolve(); return; }
    writing = true;
    const line = queue.shift();
    const done = error => {
      queuedBytes -= Buffer.byteLength(line); writing = false;
      if (error) {
        failures++;
        if (Date.now() - lastErrorAt >= 60000) { lastErrorAt = Date.now(); try { onError(error); } catch {} }
      }
      // Avoid recursive calls with synchronous test sinks or immediately failing streams.
      queueMicrotask(pump);
    };
    try { sink.write(line, done); } catch (error) { done(error); }
  }
  // Writable streams can emit an error as well as calling the write callback.
  const streamError = () => {};
  sink.on?.('error', streamError);
  return {
    log(entry) {
      const line = encode(entry), bytes = Buffer.byteLength(line);
      if (queuedBytes + bytes > maxQueueBytes) { dropped++; return false; }
      queuedBytes += bytes; queue.push(line); pump(); return true;
    },
    stats: () => ({ queued_bytes: queuedBytes, dropped_pending: dropped, write_failures: failures }),
    flush: () => new Promise(resolve => { waiters.push(resolve); pump(); }),
    async close() { await this.flush(); sink.off?.('error', streamError); }
  };
}

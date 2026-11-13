import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { evaluate, stripLabels, validateBatch } from './engine.js';
export class Conflict extends Error {}
export class Store {
  constructor(path = 'runtime/ilm.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, batch_id TEXT, timestamp TEXT, component TEXT, status TEXT, result TEXT);');
  }
  submit(raw, options) {
    const batch = stripLabels(raw);
    validateBatch(batch);
    const digest = createHash('sha256').update(JSON.stringify({ batch, options })).digest('hex');
    const existing = this.db.prepare('SELECT * FROM batches WHERE id = ?').get(batch.batch_id);
    if (existing) {
      if (existing.digest !== digest) throw new Conflict('batch_id already exists with different input or execution options');
      return JSON.parse(existing.result);
    }
    const result = { batch_id: batch.batch_id, mode: options.mode, processed_at: new Date().toISOString(), component: 'identity_lifecycle_manager', execution: 'no_live_target_changes', items: batch.items.map(c => evaluate(c, options)) };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO batches VALUES (?, ?, ?)').run(batch.batch_id, digest, JSON.stringify(result));
      const insert = this.db.prepare('INSERT INTO audit (batch_id,timestamp,component,status,result) VALUES (?,?,?,?,?)');
      for (const item of result.items) insert.run(batch.batch_id, result.processed_at, result.component, item.final_state, JSON.stringify(item));
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return result;
  }
  get(id) { const row = this.db.prepare('SELECT result FROM batches WHERE id=?').get(id); return row ? JSON.parse(row.result) : null; }
  audit(id) { return this.db.prepare('SELECT * FROM audit WHERE batch_id=? ORDER BY id').all(id).map(x => ({ ...x, result: JSON.parse(x.result) })); }
  close() { this.db.close(); }
}

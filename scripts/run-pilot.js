import { readFileSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { getServiceToken } from '../ilm/auth.js';
import { finished } from 'node:stream/promises';
import { Store } from '../ilm/store.js';
import { createServer } from '../ilm/server.js';
import { createLogger } from '../ilm/logging.js';
import { stripLabels } from '../ilm/engine.js';
import { evaluate } from '../ilm/engine.js';
import { PilotTargets } from '../ilm/simulator.js';
const source = JSON.parse(readFileSync(new URL('../data/RECITALS_PPC_PoC_Package/recitals_scenario1_compact_normalized_dataset.json', import.meta.url), 'utf8'));
// Authenticate with Keycloak before creating local output or starting the API.
const token = await getServiceToken();
// Expected answers remain in this evaluation harness, outside the processor.
const store = new Store('runtime/pilot.sqlite');
mkdirSync('runtime', { recursive: true });
// Each run uses a temporary loopback API validating the real Keycloak token.
const logFile = createWriteStream('runtime/scenario1-http.jsonl', { flags: 'w', mode: 0o600 });
const terminalLogger = createLogger(), fileLogger = createLogger({ sink: logFile });
const logger = { log(entry) { terminalLogger.log(entry); fileLogger.log(entry); } };
const server = createServer({ store, allowReplay: true, logger });
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/identity-lifecycle/cases/batch?mode=replay&as_of=2027-01-02T00%3A00%3A00Z`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': source.batch_id },
    body: JSON.stringify(stripLabels(source)),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Pilot API returned HTTP ${response.status}`);
  const checks = result.items.map((item, i) => ({ case_id: item.case_id, decision: item.decision, final_state: item.final_state, passed: item.decision === source.items[i].expected_recitals.decision && item.final_state === source.items[i].expected_recitals.final_state }));
  mkdirSync('runtime', { recursive: true });
  writeFileSync('runtime/scenario1-results.json', JSON.stringify({ result, checks }, null, 2));
  const targets = new PilotTargets();
  const simulations = source.items.map(raw => {
    const c = stripLabels(raw);
    if (c.current_access.length) targets.seed(c.subject, c.current_access);
    const plan = evaluate(c, { asOf: '2027-01-02T00:00:00Z' });
    return targets.execute(c.subject, plan, { failAt: c.case_type === 'provisioning_failure' ? 1 : -1 });
  });
  writeFileSync('runtime/scenario1-simulation.json', JSON.stringify({ simulations, identities: Object.fromEntries(targets.identities) }, null, 2));
  console.table(checks);
  console.log('Synthetic evidence replay. No identities or target systems were modified. Results: runtime/scenario1-results.json');
  console.log('HTTP request/response summaries: runtime/scenario1-http.jsonl (replaced on each run). The temporary pilot API is separate from Docker.');
  if (checks.some(c => !c.passed)) process.exitCode = 1;
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await Promise.all([terminalLogger.close(), fileLogger.close()]);
  logFile.end();
  await finished(logFile);
  store.close();
}

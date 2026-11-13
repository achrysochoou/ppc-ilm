import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Store } from '../ilm/store.js';
import { stripLabels } from '../ilm/engine.js';
import { evaluate } from '../ilm/engine.js';
import { PilotTargets } from '../ilm/simulator.js';
const source = JSON.parse(readFileSync(new URL('../data/RECITALS_PPC_PoC_Package/recitals_scenario1_compact_normalized_dataset.json', import.meta.url), 'utf8'));
// Expected answers remain in this evaluation harness, outside the processor.
const store = new Store('runtime/pilot.sqlite');
try {
  const result = store.submit(stripLabels(source), { mode: 'replay', asOf: '2027-01-02T00:00:00Z' });
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
  if (checks.some(c => !c.passed)) process.exitCode = 1;
} finally { store.close(); }

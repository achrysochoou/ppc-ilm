import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startIssuer } from '../test-support/oidc.js';

test('pilot exercises HTTP and logs each run even when batch results are cached', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ilm-pilot-'));
  const provider = await startIssuer();
  try {
    for (let run = 0; run < 2; run++) {
      const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../scripts/run-pilot.js', import.meta.url))], { cwd: directory, timeout: 30000, env: { ...process.env, KEYCLOAK_ISSUER: provider.issuer, KEYCLOAK_JWKS_URL: `${provider.issuer}/protocol/openid-connect/certs`, ILM_PILOT_CLIENT_SECRET: provider.secret, ILM_AUDIENCE: 'ilm-api', ILM_PILOT_CLIENT_ID: 'ilm-pilot' } });
      const logs = readFileSync(join(directory, 'runtime/scenario1-http.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(logs.length, 2);
      assert.equal(logs[0].event, 'http.request');
      assert.equal(logs[1].event, 'http.response');
      assert.equal(logs[0].request_id, logs[1].request_id);
      assert.equal(logs[1].status, 200);
      assert.equal(logs[1].request.case_count, 12);
      assert.equal(logs[1].response.case_count, 12);
      assert.ok(stdout.includes('"event":"http.response"'));
      assert.equal(JSON.stringify(logs).includes('Bearer'), false);
      const output = JSON.parse(readFileSync(join(directory, 'runtime/scenario1-results.json'), 'utf8'));
      assert.equal(output.checks.length, 12);
      assert.ok(output.checks.every(c => c.passed));
    }
  } finally { await provider.close(); rmSync(directory, { recursive: true, force: true }); }
});

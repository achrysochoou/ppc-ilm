# PPC ILM Scenario 1 pilot

This repository runs a Scenario 1 policy and action-planning API alongside the Syncope, OpenLDAP and Keycloak development stack. It processes all 12 supplied cases. It does not yet execute plans against Syncope, LDAP, Keycloak, Entra, SAP or Grafana. Live provisioning, notifications, session revocation and PIM integration remain unimplemented.

## Run the functional pilot

Requires Node.js 24 or later. No npm packages need installing.

```powershell
node scripts/setup-env.js
npm test
npm run pilot
npm start
```

The pilot creates two ignored local artifacts:

- `runtime/scenario1-results.json`: synthetic historical-evidence replay and decision/state comparisons for all 12 cases. Expected answers are used only by the evaluation harness after processing.
- `runtime/scenario1-simulation.json`: action execution against in-memory target doubles, including injected partial failure and compensation. These model accounts, access, sessions and grant expiry; they are not real services.

The supplied data directory is not modified. Runtime output and secrets are ignored by Git.

## API

The API listens on http://127.0.0.1:8000. All routes except readiness require `Authorization: Bearer <ILM_API_TOKEN>` from `.env.local`. This is a local pilot service credential; Keycloak user/service token validation is not implemented.

```powershell
$pilot = Get-Content -Raw data/RECITALS_PPC_PoC_Package/recitals_scenario1_compact_normalized_dataset.json
$tokenLine = Get-Content .env.local | Where-Object { $_ -like 'ILM_API_TOKEN=*' }
$token = $tokenLine.Substring('ILM_API_TOKEN='.Length)
$headers = @{
  Authorization = "Bearer $token"
  'Idempotency-Key' = ($pilot | ConvertFrom-Json).batch_id
}
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/identity-lifecycle/cases/batch -Headers $headers -ContentType application/json -Body $pilot
```

Default `plan` mode computes actions without changing targets. Future-effective cases are marked `scheduled`; this is a planning status, not a background job. `?as_of=<timezone-qualified timestamp>` supplies a reproducible planning clock. `?mode=replay` requires both `synthetic: true` and `ILM_ALLOW_REPLAY=true` on the server. Replay evaluates supplied historical execution evidence: `completed` in replay does not assert live changes or target readback.

- Results: `GET /api/v1/identity-lifecycle/batches/{batch_id}`
- Audit: `GET /api/v1/identity-lifecycle/batches/{batch_id}/audit`
- Readiness: `GET /health/ready`

Batches contain 1-50 cases and are limited to 1 MiB. Identical batch IDs and payloads return the original result; reuse with different content/options returns 409. Invalid structure returns 400 without partial storage. Business-policy rejection is a per-case result. SQLite persists results and audit entries in one transaction. Changing evaluation labels does not change batch identity.

## Policy behavior

Policies and birthright profiles are operator-owned in `ilm/engine.js`, never loaded from submitted reference data or policy conclusions. The processor removes `ground_truth`, `expected_recitals`, `expected_batch_result` and `policy_evaluation` before evaluation and persistence.

Checks cover lifecycle source authority, mandatory fields, approvals, contractor expiry, duplicate matches, Finance segregation of duties, time-bound employee PIM eligibility, old-access removal, access-review revocation and leaver account/session/access actions. Security exceptions produce recommendations for PPC SOC/IAM review with `automatic_execution: false`. Severity uses `medium` in place of the dataset's non-severity value `extended`.

Approval records and current access are trusted synthetic context; source strings do not authenticate real HR or ServiceNow events. The processor is a functional pilot, not a production governance engine or threat detector.

## Docker stack

```powershell
node scripts/setup-env.js
 docker compose --env-file .env.local config --quiet
 docker compose --env-file .env.local up -d --build
```

Ports bind to localhost. PostgreSQL readiness gates Syncope and Keycloak startup. PostgreSQL, LDAP, ZooKeeper and ILM results use persistent volumes. ZooKeeper, Mailpit and Adminer have explicit version tags. Secrets are generated into ignored `.env.local`; fresh database initialization reads passwords from the environment.

Existing initialized volumes retain their passwords: changing environment values does not rotate database or LDAP credentials. Preserve volumes and provide matching credentials or perform a deliberate migration. Do not use `down -v` against data you need. Database initialization scripts run only for a fresh data directory.

| Service | Local URL |
|---|---|
| ILM | http://localhost:8000/health/ready |
| Keycloak | http://localhost:8080 |
| Syncope Core | http://localhost:18080/syncope |
| Syncope Console | http://localhost:28080/syncope-console |
| Syncope Enduser | http://localhost:38080/syncope-enduser |
| Mailpit | http://localhost:8025 |
| Adminer | http://localhost:8081 |
| phpLDAPadmin | https://localhost:6443 |

Keycloak remains in development mode. Syncope retains its image's bootstrap admin defaults until changed; ZooKeeper discovery has no configured authentication. Use this stack as an isolated local pilot. Syncope WA and SRA are not deployed.

## Remaining live integrations

Agree on local equivalents for dataset targets: LDAP groups cannot implement Entra PIM or SAP authorization semantics. Configure and verify a Syncope LDAP resource with user/group mappings, Keycloak LDAP federation and group mappings, and application clients. Then add a target executor with readback, propagation-failure handling, durable compensation, retry/reconciliation, and effective-date/expiry scheduling. Keycloak session revocation requires its own verified admin integration. Issue live completion only after targets confirm each action.

Official references: [Syncope provisioning](https://syncope.apache.org/docs/4.1/reference-guide.html), [Keycloak containers](https://www.keycloak.org/server/containers).

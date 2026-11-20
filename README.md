# PPC ILM Scenario 1 pilot

This repository runs a Scenario 1 policy and action-planning API alongside the Syncope, OpenLDAP and Keycloak development stack. It processes all 12 supplied cases. It does not yet execute plans against Syncope, LDAP, Keycloak, Entra, SAP or Grafana. Live provisioning, notifications, session revocation and PIM integration remain unimplemented.

## Run the functional pilot

Requires Node.js 24 or later. No npm packages need installing.

```powershell
node scripts/setup-env.js
npm test
docker compose --env-file .env.local up -d --wait db keycloak
npm run pilot
npm start
```

`npm run pilot` starts a temporary authenticated API on a free loopback port,
submits the sanitized Scenario 1 batch over HTTP, then shuts that API down. It
obtains a service-account access token from Keycloak first. Start Keycloak and
PostgreSQL before running it. It does not send case traffic to the deployed ILM
container; its temporary API validates the token against the same realm's keys.
`npm test` uses isolated signing-key/token-server fixtures and needs no Docker.
Request/response summaries appear in the terminal, including on repeat runs when
the batch result is cached. One batch containing 12 cases produces one HTTP
request/response pair; the simulation still runs locally without HTTP target calls.

The pilot creates three ignored local artifacts:

- `runtime/scenario1-results.json`: synthetic historical-evidence replay and decision/state comparisons for all 12 cases. Expected answers are used only by the evaluation harness after processing.
- `runtime/scenario1-simulation.json`: action execution against in-memory target doubles, including injected partial failure and compensation. These model accounts, access, sessions and grant expiry; they are not real services.
- `runtime/scenario1-http.jsonl`: structured HTTP request/response summaries,
  replaced on every pilot run. Full payloads and credentials are excluded.

The supplied data directory is not modified. Runtime output and secrets are ignored by Git.

## API

The API listens on http://127.0.0.1:8000. All routes except readiness require
`Authorization: Bearer <Keycloak access_token>`. Static `ILM_API_TOKEN` values are
no longer accepted. The pilot realm is `ppc-pilot`, with resource client `ilm-api`
and confidential service-account client `ilm-pilot`. The generated client secret
is held in ignored `.env.local`, not in the realm JSON.

ILM verifies RS256 signatures using Keycloak's JWKS, exact issuer, audience
`ilm-api`, expiry, not-before and issued-at timestamps. Keys are cached for five
minutes, with a rate-limited refresh for new signing keys. Invalid/missing tokens
return 401; insufficient roles return 403; unavailable signing keys return 503.
Only client roles in `resource_access.ilm-api.roles` authorize access:

| Role | Permission |
|---|---|
| `ilm-submit` | POST case batches |
| `ilm-read` | GET batch results |
| `ilm-audit-read` | GET batch audit records |

The pilot service account has all three roles. `GET /health/ready` remains public
and reports process readiness, not Keycloak availability. Tokens and client
secrets are excluded from request logs. The pilot requests one short-lived token
per run using `client_credentials`; it never uses administrator credentials.

After starting the ILM and Keycloak containers, run `npm run check:auth` to verify
real service-account token issuance, the three mapped roles, and the deployed
API's authentication behavior. It makes no case or identity changes. Set
`ILM_BASE_URL` if testing an ILM address other than `http://127.0.0.1:8000`.

```powershell
$pilot = Get-Content -Raw data/RECITALS_PPC_PoC_Package/recitals_scenario1_compact_normalized_dataset.json
$config = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
$auth = Invoke-RestMethod -Method Post -Uri "$($config.KEYCLOAK_ISSUER)/protocol/openid-connect/token" -Body @{
  grant_type = 'client_credentials'
  client_id = $config.ILM_PILOT_CLIENT_ID
  client_secret = $config.ILM_PILOT_CLIENT_SECRET
}
$headers = @{
  Authorization = "Bearer $($auth.access_token)"
  'Idempotency-Key' = ($pilot | ConvertFrom-Json).batch_id
}
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/identity-lifecycle/cases/batch -Headers $headers -ContentType application/json -Body $pilot
```

Default `plan` mode computes actions without changing targets. Future-effective cases are marked `scheduled`; this is a planning status, not a background job. `?as_of=<timezone-qualified timestamp>` supplies a reproducible planning clock. `?mode=replay` requires both `synthetic: true` and `ILM_ALLOW_REPLAY=true` on the server. Replay evaluates supplied historical execution evidence: `completed` in replay does not assert live changes or target readback.

- Results: `GET /api/v1/identity-lifecycle/batches/{batch_id}`
- Audit: `GET /api/v1/identity-lifecycle/batches/{batch_id}/audit`
- Readiness: `GET /health/ready`

Batches contain 1-50 cases and are limited to 1 MiB. Identical batch IDs and payloads return the original result; reuse with different content/options returns 409. Invalid structure returns 400 without partial storage. Business-policy rejection is a per-case result. SQLite persists results and audit entries in one transaction. Changing evaluation labels does not change batch identity.

## Request and response logs

The API writes one JSON line for request receipt and another for response completion
or disconnection. `X-Request-ID` is returned to the caller and included in both
records; safe IDs supplied by callers are preserved. Response logs contain the
route template, HTTP status, elapsed milliseconds, byte counts, a SHA-256 batch
reference and case/record counts. Rejected requests and storage failures are logged
too. Successful readiness probes are excluded unless `ILM_LOG_HEALTH=true`.

Logging uses an explicit metadata allowlist: raw bodies, headers, query strings,
identity attributes, passwords, tokens, expected answers and raw exception messages
are excluded. These are operational summaries, not full request/response archives.
Lifecycle decisions remain in the separate SQLite audit store.

The writer queues at most `ILM_LOG_QUEUE_BYTES` bytes (default 1 MiB). A slow sink
causes excess records to be dropped, followed by a `logging.dropped` count when it
catches up. Logging does not block requests awaiting delivery. Sink failures are
counted and reported to stderr at most once per minute. This is best-effort
operational logging, not a guaranteed-delivery compliance journal. Shutdown drains
the queue with a ten-second deadline.

Docker's local logging driver retains five files of up to 10 MiB each for the ILM
container, rotating automatically. This is size-based retention, not a time-based
archive. View records with:

```powershell
docker compose --env-file .env.local logs --tail 100 -f ilm
```

When using `npm start`, output goes to the terminal; the process supervisor or
collector must provide rotation. SQLite audit retention is independent and has
not been changed. Live external connector calls are still unimplemented, so their
outbound request/response logging is not yet present.

## Policy behavior

Policies and birthright profiles are operator-owned in `ilm/engine.js`, never loaded from submitted reference data or policy conclusions. The processor removes `ground_truth`, `expected_recitals`, `expected_batch_result` and `policy_evaluation` before evaluation and persistence.

Checks cover lifecycle source authority, mandatory fields, approvals, contractor expiry, duplicate matches, Finance segregation of duties, time-bound employee PIM eligibility, old-access removal, access-review revocation and leaver account/session/access actions. Security exceptions produce recommendations for PPC SOC/IAM review with `automatic_execution: false`. Severity uses `medium` in place of the dataset's non-severity value `extended`.

Approval records and current access are trusted synthetic context; source strings do not authenticate real HR or ServiceNow events. The processor is a functional pilot, not a production governance engine or threat detector.

## Docker stack

Keycloak imports `keycloak/ppc-pilot-realm.json` at startup. Its secret placeholder
is resolved from the container environment. Existing realms are skipped on
startup: if `ppc-pilot` already exists, review and apply client, mapper, role and
service-account changes through the Keycloak admin console; startup does not
overwrite existing realm configuration or rotate an existing client secret.

The canonical local issuer is `http://localhost:8080/realms/ppc-pilot`. Host tools
fetch keys there; the ILM container fetches keys through the private
`http://keycloak:8080/.../certs` address while checking the same canonical issuer.
Do not set the issuer to the Docker hostname just to make network access work.
For a VM, use its actual Keycloak public URL in `KEYCLOAK_PUBLIC_URL` and the
matching realm issuer in `KEYCLOAK_ISSUER`. Use HTTPS, production Keycloak startup
and `sslRequired=external` or `all` outside the isolated local development setup.
The imported realm deliberately allows HTTP for this local pilot.

If host port 8080 is occupied, set `KEYCLOAK_HTTP_PORT` to an available port and
update both `KEYCLOAK_PUBLIC_URL` and `KEYCLOAK_ISSUER` in `.env.local` to match.
The container continues to use port 8080 internally.

```powershell
node scripts/setup-env.js
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local up -d --build --wait
```

Ports bind to localhost. PostgreSQL readiness gates Syncope and Keycloak startup. PostgreSQL, LDAP, ZooKeeper and ILM results use persistent volumes. ZooKeeper, Mailpit and Adminer have explicit version tags. Secrets are generated into ignored `.env.local`; fresh database initialization reads passwords from the environment.

PostgreSQL is available only on the Docker network as `db:5432`; it does not bind
a host port. Adminer and the identity services can access it internally without
conflicting with other databases running on the VM or development machine.

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

Official references: [Syncope provisioning](https://syncope.apache.org/docs/4.1/reference-guide.html), [Keycloak containers](https://www.keycloak.org/server/containers), [realm import](https://www.keycloak.org/server/importExport), [Keycloak administration and service accounts](https://www.keycloak.org/docs/latest/server_admin/index.html).

# RECITALS Scenario 1 — Compact Normalized Dataset

## Purpose

This dataset provides synthetic, normalized direct input for a functional proof of concept of **RECITALS Scenario 1: Identity lifecycle management for PPC employees and external collaborators**. In the pilot, the dataset is submitted directly to the Identity Lifecycle Manager; no adapter or PPRL component is included.

It covers the business instruction, identity and access state, governance decision, requested change, execution result, and optional security evidence for each already-correlated lifecycle case. It is intended for functional and integration testing, not ML training or performance testing.

Related payload: `recitals_scenario1_compact_normalized_dataset.json`

## Source responsibilities

| Data category | Authoritative or primary source | Role in the payload |
|---|---|---|
| Employee Joiner/Mover/Leaver events | PPC HRMS | Defines what should happen and when |
| Contractor lifecycle | Vendor/contractor portal | Defines sponsor, contract, and expiration |
| Access request and approval | ServiceNow or Entra Governance | Records request, approver, decision, and validity |
| Identity/access state and enforcement | Entra ID, AD, SAP, Grafana, other application APIs | Reports current access and applies changes |
| Role and access policies | IGA/policy repository, Entra Governance, application owners | Defines access profiles, SoD, PIM, and lifecycle rules |
| Security evidence | Sentinel and Defender | Adds incidents, risky activity, and device/identity risk; it is not the lifecycle authority |

## Normalized API contract

Proposed endpoint:

```http
POST /api/v1/identity-lifecycle/cases/batch
Content-Type: application/json
Idempotency-Key: <batch_id>
```

Each `items[]` object represents one correlated identity lifecycle case.

| Field | Meaning |
|---|---|
| `case_id` | Stable synthetic case identifier |
| `case_type` | Joiner, Mover, Leaver, request, review, reconciliation, or exception |
| `scenario_tier` | Applicable pilot tier: `light`, `extended`, or both |
| `authoritative_event` | Business instruction from HRMS, vendor portal, ServiceNow, or a security exception from Sentinel |
| `subject` | Normalized identity with stable correlation identifiers |
| `access_request` | Requested access, approval, reason, and expiration; null when not applicable |
| `current_access` | Entitlements held before processing |
| `policy_evaluation` | Applicable policies, allow/deny/hold result, and violations |
| `requested_changes` | Provisioning, revocation, or containment actions |
| `execution_evidence` | Results returned by Entra ID, AD, or applications |
| `security_context` | Optional Sentinel/Defender evidence |
| `ground_truth` | Expected test label; evaluation profile only |
| `expected_recitals` | Expected RECITALS decision; evaluation profile only |

## Case coverage

The dataset contains **12 test cases inside RECITALS Scenario 1**. These are test cases, not 12 separate RECITALS use-case scenarios.

| Case ID | Test case | Tier | Expected RECITALS behavior |
|---|---|---|---|
| `S1-JOINER-001` | Valid employee onboarding | Light + Extended | Approve and provision birthright access |
| `S1-JOINER-002` | Time-bound contractor onboarding | Light + Extended | Provision guest access with contract expiry |
| `S1-MOVER-001` | Employee department/role change | Light + Extended | Add new access and remove obsolete access |
| `S1-REQUEST-001` | Access request violating segregation of duties | Extended | Deny and notify |
| `S1-LEAVER-001` | Employee termination | Light + Extended | Disable identity, revoke sessions, and remove access |
| `S1-PROVISION-001` | Partial provisioning failure | Light + Extended | Roll back and create a recoverable work item |
| `S1-REVIEW-001` | Privileged-access recertification | Extended | Revoke unused PIM eligibility |
| `S1-SECURITY-001` | Unauthorized privilege change | Extended | Raise a security exception and recommendations for PPC SOC/IAM review; execute nothing automatically |
| `S1-JOINER-003` | Joiner missing mandatory manager data | Light + Extended | Reject before provisioning and request missing data |
| `S1-MATCH-001` | Possible duplicate identity | Extended | Hold and request identity reconciliation |
| `S1-REQUEST-002` | Valid time-bound privileged-access request | Extended | Provision PIM eligibility with expiry |
| `S1-LEAVER-002` | Contractor contract expiry | Light + Extended | Automatically expire and revoke all access |

### Added in version 1.1

The four added cases improve boundary and happy-path coverage:

1. **Input validation** — prevents provisioning when mandatory lifecycle data are missing.
2. **Identity reconciliation** — prevents duplicate Entra identities when a potential match is ambiguous.
3. **Approved privileged access** — verifies the legitimate PIM path, balancing the existing denial and malicious cases.
4. **Contractor expiration** — validates automatic offboarding at contract end, complementing contractor onboarding.

### Updated in version 1.2

- Renamed the earlier `medium` tier to `extended` to match the PPC use-case document.
- Added the direct five-component Extended Scenario workflow profile and explicitly excluded an adapter from the pilot.
- Changed the unauthorized privilege-change case from executable containment to a security exception with recommendations for PPC SOC/IAM human review and `automatic_execution: false`.

## Light and Extended Scenario sufficiency

### Light pilot

The light set covers:

- Employee and contractor onboarding
- Mandatory-input rejection
- Employee Mover processing
- Employee and contractor offboarding
- Partial provisioning failure and rollback

This is sufficient for a compact functional PoC of core Joiner/Mover/Leaver orchestration.

### Extended Scenario

The Extended Scenario set includes all light cases plus:

- SoD policy enforcement
- Successful time-bound PIM eligibility
- Access review and recertification
- Duplicate-identity reconciliation
- Unauthorized privilege change with optional Sentinel/Defender evidence and recommendation-only human review

This is sufficient for a compact governance and security-aware PoC using the agreed five-component sequence: Identity Lifecycle Manager → Compliance Manager → Cyber-threat Detector → explAIner → Reporting Engine. It remains intentionally smaller than a production test suite.

## Processing flow

For every case, RECITALS should:

1. Validate the schema, source authority, identifiers, and mandatory fields.
2. Confirm or reconcile the identity.
3. Compare current access with the requested access/profile.
4. Evaluate approvals, SoD, PIM, contractor, and JML policies.
5. Produce lifecycle provisioning, revocation or rollback actions; for security exceptions, produce recommendations for PPC human review only.
6. Evaluate execution evidence and set the final case state.
7. Return an explanation and complete audit trail.

Example submission:

```bash
curl -X POST http://localhost:8000/api/v1/identity-lifecycle/cases/batch \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: s1-compact-20260722-003" \
  --data-binary @recitals_scenario1_compact_normalized_dataset.json
```

## Evaluation and production profiles

For evaluation, compare actual RECITALS output with:

- `ground_truth`
- `expected_recitals`
- `expected_batch_result`

For production inference, remove those fields before sending the payload. Replace synthetic identifiers with stable pseudonymous identifiers and apply purpose-based data minimization. RECITALS should never receive raw passwords, secrets, tokens, or unnecessary personal information.

## Limitations

The endpoint is a proposed contract because the RECITALS specifications do not define an implemented Scenario 1 ingestion API. The dataset validates workflow and integration behavior but does not provide adequate volume for performance, resilience, or statistical detection testing.

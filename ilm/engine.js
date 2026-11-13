// Policy configuration is operator-owned, never loaded from a submitted batch.
export const profiles = {
  'AP-CLOUD-ENGINEER': { department: 'Cloud Operations', employment_type: 'employee', access: ['entra:group:PPC-Cloud-Engineering', 'entra:group:PPC-Azure-Readers', 'grafana:role:Viewer'] },
  'AP-FINANCE-ANALYST': { department: 'Finance', employment_type: 'employee', access: ['entra:group:PPC-Finance', 'sap:role:FI_DISPLAY'] },
  'AP-OBS-CONTRACTOR': { employment_type: 'contractor', access: ['entra:group:PPC-External-Collaborators', 'grafana:role:Viewer'] }
};
export function stripLabels(value) {
  if (Array.isArray(value)) return value.map(stripLabels);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['ground_truth', 'expected_recitals', 'expected_batch_result', 'policy_evaluation'].includes(k)).map(([k, v]) => [k, stripLabels(v)]));
}
export function timestamp(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('A timezone-qualified timestamp is required');
  return Date.parse(value);
}
const types = new Set(['joiner', 'joiner_validation_failure', 'mover', 'leaver', 'contractor_expiration', 'provisioning_failure', 'access_request', 'privileged_access_request', 'access_review', 'identity_reconciliation', 'unauthorized_lifecycle_change']);
export function validateBatch(batch) {
  if (!batch || typeof batch.batch_id !== 'string' || !batch.batch_id.trim() || !Array.isArray(batch.items) || batch.items.length < 1 || batch.items.length > 50) throw new Error('batch_id and 1–50 items are required');
  const ids = new Set();
  for (const item of batch.items) {
    if (!item || typeof item.case_id !== 'string' || !item.case_id || ids.has(item.case_id)) throw new Error('Unique case_id values are required');
    ids.add(item.case_id);
    if (!types.has(item.case_type)) throw new Error(`Unsupported case_type for ${item.case_id}`);
    if (!item.subject || !item.authoritative_event || !Array.isArray(item.current_access) || !item.current_access.every(x => typeof x === 'string')) throw new Error(`Invalid case structure: ${item.case_id}`);
    if (item.requested_changes !== undefined && (!Array.isArray(item.requested_changes) || item.requested_changes.some(x => !x || typeof x !== 'object'))) throw new Error('Invalid requested_changes');
    if (item.execution_evidence !== undefined && (!Array.isArray(item.execution_evidence) || item.execution_evidence.some(x => !x || typeof x !== 'object'))) throw new Error('Invalid execution_evidence');
  }
}
export function evaluate(raw, { mode = 'plan', asOf = new Date().toISOString() } = {}) {
  const c = stripLabels(raw), s = c.subject, request = c.access_request || {}, approval = request.approval || {};
  const result = (decision, final_state, severity, reasons, actions = []) => ({ case_id: c.case_id, person_id: s.person_id, decision, final_state, severity, reasons, actions, mode, automatic_execution: false, evidence_refs: (c.execution_evidence || []).map(e => e.event_id).filter(Boolean) });
  const invalid = reason => result('reject_and_request_missing_data', 'input_invalid', 'low', [reason]);
  let effective;
  try { effective = timestamp(c.effective_at); timestamp(asOf); } catch (e) { return invalid(e.message); }
  if (!s.person_id || !s.upn || !['employee', 'contractor'].includes(s.employment_type)) return invalid('person_id, upn and employment_type are required');
  if (c.case_type === 'unauthorized_lifecycle_change') return { ...result('raise_security_exception_for_human_review', 'awaiting_ppc_soc_iam_review', 'critical', ['Unapproved identity change requires PPC SOC/IAM review']), recommended_actions: ['revoke_sessions', 'remove_newly_assigned_role', 'temporarily_disable_account_if_ppc_approves'] };
  const lifecycle = ['joiner', 'joiner_validation_failure', 'mover', 'leaver', 'contractor_expiration', 'provisioning_failure', 'identity_reconciliation'].includes(c.case_type);
  const source = c.authoritative_event.source;
  if (lifecycle && source !== (s.employment_type === 'employee' ? 'ppc_hrms' : 'ppc_vendor_portal')) return invalid('Lifecycle source is not authoritative for this subject');
  if (!lifecycle && !['servicenow', 'entra_governance'].includes(source)) return invalid('Access changes require an approved workflow source');
  const leaving = ['leaver', 'contractor_expiration'].includes(c.case_type);
  if (!c.authoritative_event.source_event_id) return invalid('source_event_id is required');
  if (leaving && !['terminated', 'expired'].includes(c.authoritative_event.status)) return invalid('Leaver requires a termination or expiration event');
  if (!leaving && s.employment_type === 'employee' && !s.manager_person_id) return invalid('manager_person_id is mandatory');
  if (s.employment_type === 'contractor') {
    if (!s.sponsor_person_id || !s.contract_end) return invalid('Contractors require sponsor and contract_end');
    try {
      const end = timestamp(s.contract_end);
      if (!leaving && end <= effective) return invalid('Contract has already expired at effective_at');
      if (c.case_type === 'contractor_expiration' && effective < end) return invalid('Cannot expire a contractor before contract_end');
      if (!leaving && c.case_type !== 'access_review' && (!request.requested_expiration || timestamp(request.requested_expiration) > end)) return invalid('Access expiry must not exceed contract_end');
    } catch (e) { return invalid(e.message); }
  }
  if ((c.identity_match_candidates || []).length) return result('hold_and_request_identity_review', 'awaiting_human_review', 'medium', ['Potential duplicate identity; reconcile before provisioning']);
  if (c.case_type === 'identity_reconciliation') return result('hold_and_request_identity_review', 'awaiting_human_review', 'medium', ['Identity reconciliation requires an operator decision']);
  if (!leaving) {
    const requiredStatus = c.case_type === 'access_review' ? 'revoke' : 'approved';
    if (approval.status !== requiredStatus || !approval.approver_role || !approval.decided_at) return result('hold_for_approval', 'awaiting_human_review', 'medium', ['Recorded workflow approval is required']);
    try { if (timestamp(approval.decided_at) > effective) return invalid('Approval must precede effective_at'); } catch (e) { return invalid(e.message); }
  }
  let actions = [], decision;
  if (leaving) {
    decision = c.case_type === 'contractor_expiration' ? 'expire_and_revoke_all_access' : 'revoke_all_access';
    actions = ['disable_user', 'revoke_sessions', 'remove_all_access'].map(operation => ({ operation, person_id: s.person_id }));
  } else if (c.case_type === 'access_review') {
    if (!Array.isArray(request.reviewed_entitlements) || !request.reviewed_entitlements.length || request.reviewed_entitlements.some(e => !c.current_access.includes(e))) return invalid('Review must identify held entitlements');
    decision = 'revoke_reviewed_access';
    actions = request.reviewed_entitlements.map(entitlement => ({ operation: 'remove', entitlement }));
  } else {
    let desired;
    if (request.access_profile_id) {
      const profile = profiles[request.access_profile_id];
      if (!profile || profile.employment_type !== s.employment_type || (profile.department && profile.department !== s.department)) return invalid('Access profile does not match subject');
      desired = profile.access;
    } else desired = request.requested_entitlements;
    if (!Array.isArray(desired) || !desired.length || desired.some(e => typeof e !== 'string')) return invalid('A known access profile or requested_entitlements is required');
    const combined = new Set([...c.current_access, ...desired]);
    if (combined.has('sap:role:PAYMENT_CREATOR') && combined.has('sap:role:PAYMENT_APPROVER')) return result('deny_and_notify', 'policy_blocked', 'high', ['POL-SOD-001: payment creation and approval cannot coexist']);
    const privileged = desired.filter(e => /:role:/.test(e) && /azure:|entra:/.test(e));
    if (privileged.length && (s.employment_type !== 'employee' || privileged.some(e => !e.endsWith(':pim_eligible')) || !request.requested_expiration)) return result('deny_and_notify', 'policy_blocked', 'high', ['POL-PAM-001: privileged access must be time-bound employee PIM eligibility']);
    if (request.requested_expiration) {
      try { if (timestamp(request.requested_expiration) <= effective) return invalid('Access expiry must follow effective_at'); } catch (e) { return invalid(e.message); }
    }
    if (c.case_type === 'mover') actions.push(...c.current_access.filter(e => !desired.includes(e)).map(entitlement => ({ operation: 'remove', entitlement })));
    if (['joiner', 'joiner_validation_failure', 'provisioning_failure'].includes(c.case_type)) actions.push({ operation: 'create_user', person_id: s.person_id, upn: s.upn });
    actions.push(...desired.filter(e => !c.current_access.includes(e)).map(entitlement => ({ operation: entitlement.endsWith(':pim_eligible') ? 'add_pim_eligibility' : 'add', entitlement, ...(request.requested_expiration ? { expires_at: request.requested_expiration } : {}) })));
    decision = c.case_type === 'mover' ? 'approve_and_replace_access' : privileged.length ? 'approve_and_provision_pim_eligibility' : 'approve_and_provision';
  }
  if (mode === 'plan') return result(decision, effective > timestamp(asOf) ? 'scheduled' : 'planned', 'informational', ['Action plan only; no target changes were executed'], actions);
  const evidence = c.execution_evidence || [];
  if (evidence.some(e => e.result === 'failed')) {
    const rolledBack = evidence.some(e => /rollback/.test(e.operation) && e.result === 'success');
    return { ...result('rollback_and_raise_work_item', rolledBack ? 'failed_recoverable' : 'rollback_required', 'medium', ['Supplied evidence reports partial provisioning failure; operator recovery required'], actions), work_item: { type: 'provisioning_recovery', status: 'open' }, rollback_verified: rolledBack };
  }
  if (leaving && evidence.length) {
    try {
      if (evidence.some(e => timestamp(e.observed_at) > effective + 4 * 60 * 60 * 1000)) return result(decision, 'sla_breached', 'high', ['Supplied leaver evidence exceeds the four-hour revocation SLA'], actions);
    } catch (e) { return invalid(e.message); }
  }
  return result(decision, evidence.length && evidence.every(e => e.result === 'success') ? 'completed' : 'evidence_missing', 'informational', ['Synthetic evidence replay only; completion describes supplied evidence, not live target verification'], actions);
}

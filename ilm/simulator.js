// Target double: exercises actions independently of historical execution evidence.
export class PilotTargets {
  constructor() { this.identities = new Map(); }
  seed(subject, access) {
    if (!this.identities.has(subject.person_id)) this.identities.set(subject.person_id, { upn: subject.upn, enabled: true, sessions: 1, access: [...access], expirations: {} });
  }
  execute(subject, plan, { failAt = -1 } = {}) {
    if (plan.final_state !== 'planned') return { ...plan, executed: false };
    const before = structuredClone(this.identities.get(subject.person_id)), events = [];
    try {
      for (const [index, action] of plan.actions.entries()) {
        if (index === failAt) throw new Error('Injected pilot target failure');
        let identity = this.identities.get(subject.person_id);
        if (action.operation === 'create_user') {
          if (identity && identity.upn !== subject.upn) throw new Error('Identity conflict');
          if (!identity) { identity = { upn: subject.upn, enabled: true, sessions: 0, access: [], expirations: {} }; this.identities.set(subject.person_id, identity); }
        } else {
          if (!identity) throw new Error('Target identity not found');
          switch (action.operation) {
            case 'add': case 'add_pim_eligibility':
              if (!identity.access.includes(action.entitlement)) identity.access.push(action.entitlement);
              if (action.expires_at) identity.expirations[action.entitlement] = action.expires_at;
              break;
            case 'remove': identity.access = identity.access.filter(e => e !== action.entitlement); delete identity.expirations[action.entitlement]; break;
            case 'disable_user': identity.enabled = false; break;
            case 'revoke_sessions': identity.sessions = 0; break;
            case 'remove_all_access': identity.access = []; identity.expirations = {}; break;
            default: throw new Error('Unsupported operation');
          }
        }
        events.push({ ...action, status: 'simulated_success' });
      }
      return { ...plan, mode: 'simulation', final_state: 'simulated_completed', executed: true, events };
    } catch (error) {
      if (before) this.identities.set(subject.person_id, before); else this.identities.delete(subject.person_id);
      return { ...plan, mode: 'simulation', decision: 'rollback_and_raise_work_item', final_state: 'failed_recoverable', executed: true, events, rollback_verified: true, work_item: { type: 'provisioning_recovery', status: 'open', reason: error.message } };
    }
  }
  expire(asOf) {
    for (const identity of this.identities.values()) for (const [entitlement, expires] of Object.entries(identity.expirations)) if (Date.parse(expires) <= Date.parse(asOf)) {
      identity.access = identity.access.filter(e => e !== entitlement); delete identity.expirations[entitlement];
    }
  }
}

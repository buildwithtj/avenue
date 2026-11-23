// Member lifecycle state machine for Avenue Phase 1
// Pure functions: no external state, no side effects.
// States match schema/lists.v2.json AvenueMembers.Status choices.

export const STATES = Object.freeze([
  'Invited',
  'Paid',
  'Onboarding',
  'Active',
  'Inactive'
]);

export const EVENTS = Object.freeze([
  'paymentVerified',
  'startOnboarding',
  'activate',
  'deactivate',
  'reactivate'
]);

const ALLOWED_MOVES = {
  Invited: ['paymentVerified'],
  Paid: ['startOnboarding', 'deactivate'],
  Onboarding: ['activate', 'deactivate'],
  Active: ['deactivate'],
  Inactive: ['reactivate']
};

/**
 * Returns the list of legal events that can be applied to the given state.
 *
 * @param {string} state
 * @returns {Array<string>}
 */
export function allowedEvents(state) {
  const allowed = ALLOWED_MOVES[state];
  if (!allowed) {
    throw new Error(`Unknown state: ${state}`);
  }
  return [...allowed];
}

/**
 * Transitions a member from one state to another based on an event and context.
 *
 * @param {string} state - Current member state
 * @param {string} event - Event name (case-sensitive)
 * @param {Object} [context] - Context payload for the transition
 * @returns {string} The new state
 */
export function transition(state, event, context = {}) {
  if (!STATES.includes(state)) {
    throw new Error(`Invalid state "${state}" for event "${event}"`);
  }
  if (!EVENTS.includes(event)) {
    throw new Error(`Invalid event "${event}" for state "${state}"`);
  }

  const legalEvents = ALLOWED_MOVES[state] || [];
  if (!legalEvents.includes(event)) {
    throw new Error(`Illegal transition: cannot apply event "${event}" to state "${state}"`);
  }

  // Context validation rules:
  // 1. paymentVerified (Invited -> Paid): needs non-empty context.paymentVerifiedBy
  if (event === 'paymentVerified') {
    if (
      !context ||
      typeof context.paymentVerifiedBy !== 'string' ||
      context.paymentVerifiedBy.trim() === ''
    ) {
      throw new Error(`paymentVerified requires a non-empty context.paymentVerifiedBy in state "${state}"`);
    }
    return 'Paid';
  }

  // 2. startOnboarding (Paid -> Onboarding)
  if (event === 'startOnboarding') {
    return 'Onboarding';
  }

  // 3. activate (Onboarding -> Active):
  // Needs context.requireStaffApproval EXPLICITLY true or false (REQUIRED, no default, because Q-05 is open)
  // When true, needs a non-empty context.approvedBy
  if (event === 'activate') {
    if (!context || typeof context.requireStaffApproval !== 'boolean') {
      throw new Error(`activate requires context.requireStaffApproval to be explicitly true or false in state "${state}"`);
    }
    if (context.requireStaffApproval === true) {
      if (typeof context.approvedBy !== 'string' || context.approvedBy.trim() === '') {
        throw new Error(`activate with requireStaffApproval=true requires non-empty context.approvedBy in state "${state}"`);
      }
    }
    return 'Active';
  }

  // 4. deactivate (Active, Onboarding, Paid -> Inactive):
  // Needs a non-empty context.reason
  if (event === 'deactivate') {
    if (!context || typeof context.reason !== 'string' || context.reason.trim() === '') {
      throw new Error(`deactivate requires a non-empty context.reason in state "${state}"`);
    }
    return 'Inactive';
  }

  // 5. reactivate (Inactive -> Active):
  // Needs a non-empty context.reason
  if (event === 'reactivate') {
    if (!context || typeof context.reason !== 'string' || context.reason.trim() === '') {
      throw new Error(`reactivate requires a non-empty context.reason in state "${state}"`);
    }
    return 'Active';
  }

  // Catch-all
  throw new Error(`Unhandled legal transition for state "${state}" and event "${event}"`);
}

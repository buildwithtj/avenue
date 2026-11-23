import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition, allowedEvents, STATES, EVENTS } from './lifecycle.mjs';

test('every legal transition succeeds with valid context', () => {
  // Invited -> Paid
  assert.equal(
    transition('Invited', 'paymentVerified', { paymentVerifiedBy: 'stripe-webhook' }),
    'Paid'
  );

  // Paid -> Onboarding
  assert.equal(transition('Paid', 'startOnboarding'), 'Onboarding');

  // Paid -> Inactive (deactivate)
  assert.equal(
    transition('Paid', 'deactivate', { reason: 'Requested refund before onboarding' }),
    'Inactive'
  );

  // Onboarding -> Active (without staff approval)
  assert.equal(
    transition('Onboarding', 'activate', { requireStaffApproval: false }),
    'Active'
  );

  // Onboarding -> Active (with staff approval)
  assert.equal(
    transition('Onboarding', 'activate', { requireStaffApproval: true, approvedBy: 'staff@flavors.com' }),
    'Active'
  );

  // Onboarding -> Inactive (deactivate)
  assert.equal(
    transition('Onboarding', 'deactivate', { reason: 'Incomplete paperwork' }),
    'Inactive'
  );

  // Active -> Inactive (deactivate)
  assert.equal(
    transition('Active', 'deactivate', { reason: 'Member cancelled contract' }),
    'Inactive'
  );

  // Inactive -> Active (reactivate)
  assert.equal(
    transition('Inactive', 'reactivate', { reason: 'Returned for new season' }),
    'Active'
  );
});

test('full 5 states x 5 events matrix: exactly 7 legal moves and 18 illegal moves', () => {
  const legalPairs = new Set([
    'Invited:paymentVerified',
    'Paid:startOnboarding',
    'Paid:deactivate',
    'Onboarding:activate',
    'Onboarding:deactivate',
    'Active:deactivate',
    'Inactive:reactivate'
  ]);

  const validContext = {
    paymentVerifiedBy: 'staff-1',
    requireStaffApproval: false,
    reason: 'valid reason'
  };

  let legalCount = 0;
  let illegalCount = 0;

  for (const s of STATES) {
    const allowed = allowedEvents(s);
    for (const e of EVENTS) {
      const key = `${s}:${e}`;
      if (legalPairs.has(key)) {
        legalCount++;
        assert(allowed.includes(e), `${e} should be in allowedEvents(${s})`);
        assert.doesNotThrow(() => transition(s, e, validContext));
      } else {
        illegalCount++;
        assert(!allowed.includes(e), `${e} should NOT be in allowedEvents(${s})`);
        assert.throws(
          () => transition(s, e, validContext),
          (err) => err.message.includes(s) && err.message.includes(e),
          `Expected transition(${s}, ${e}) to throw error containing state and event`
        );
      }
    }
  }

  assert.equal(legalCount, 7);
  assert.equal(illegalCount, 18);
});

test('paymentVerified requires non-empty paymentVerifiedBy', () => {
  assert.throws(
    () => transition('Invited', 'paymentVerified', {}),
    /paymentVerifiedBy/
  );
  assert.throws(
    () => transition('Invited', 'paymentVerified', { paymentVerifiedBy: '  ' }),
    /paymentVerifiedBy/
  );
  assert.throws(
    () => transition('Invited', 'paymentVerified', { paymentVerifiedBy: null }),
    /paymentVerifiedBy/
  );
});

test('activate requires requireStaffApproval explicitly boolean', () => {
  // Missing or non-boolean
  assert.throws(() => transition('Onboarding', 'activate', {}), /requireStaffApproval/);
  assert.throws(
    () => transition('Onboarding', 'activate', { requireStaffApproval: undefined }),
    /requireStaffApproval/
  );
  assert.throws(
    () => transition('Onboarding', 'activate', { requireStaffApproval: 'false' }),
    /requireStaffApproval/
  );

  // true without approvedBy
  assert.throws(
    () => transition('Onboarding', 'activate', { requireStaffApproval: true }),
    /approvedBy/
  );
  assert.throws(
    () => transition('Onboarding', 'activate', { requireStaffApproval: true, approvedBy: '  ' }),
    /approvedBy/
  );
});

test('deactivate and reactivate require non-empty reason', () => {
  // deactivate
  assert.throws(() => transition('Active', 'deactivate', {}), /reason/);
  assert.throws(() => transition('Active', 'deactivate', { reason: '' }), /reason/);
  assert.throws(() => transition('Active', 'deactivate', { reason: '   ' }), /reason/);

  // reactivate
  assert.throws(() => transition('Inactive', 'reactivate', {}), /reason/);
  assert.throws(() => transition('Inactive', 'reactivate', { reason: '' }), /reason/);
  assert.throws(() => transition('Inactive', 'reactivate', { reason: '   ' }), /reason/);
});

test('hardening M7: no random event sequence ever reaches a state outside the five (500 cases)', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(11223344);

  for (let iter = 0; iter < 500; iter++) {
    let currentState = STATES[Math.floor(rng() * STATES.length)];
    const steps = 20;

    for (let step = 0; step < steps; step++) {
      const event = EVENTS[Math.floor(rng() * EVENTS.length)];
      const context = {
        paymentVerifiedBy: 'bot',
        requireStaffApproval: rng() > 0.5,
        approvedBy: 'staff-lead',
        reason: 'routine change'
      };

      try {
        currentState = transition(currentState, event, context);
      } catch (err) {
        // Illegal moves are expected and thrown
      }

      assert(
        STATES.includes(currentState),
        `State machine reached invalid state "${currentState}"`
      );
    }
  }
});

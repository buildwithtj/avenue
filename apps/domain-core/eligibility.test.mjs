import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequest } from './eligibility.mjs';

const NOW_UTC = '2026-11-13T12:00:00.000Z';
const VALID_START = '2026-11-13T14:00:00.000Z';
const VALID_END = '2026-11-13T16:00:00.000Z';

const baseInput = () => ({
  requesterEmail: 'member@flavors.com',
  onBehalfOf: undefined,
  requesterIsStaff: false,
  facilityId: 'flavors-hyattsville',
  space: 'Kitchen',
  equipmentIds: ['eq-1'],
  knownActiveEquipmentIds: ['eq-1', 'eq-2'],
  startUtc: VALID_START,
  endUtc: VALID_END,
  nowUtc: NOW_UTC,
  memberships: [{ memberId: 'member@flavors.com', status: 'Active' }],
  documents: [{ expiryDate: '2026-12-01', supersededBy: null }],
  activeOverrideForMember: false,
  privateEventOverlap: false,
  overdue: undefined
});

test('valid request by member returns Pending with empty reason', () => {
  const res = evaluateRequest(baseInput());
  assert.equal(res.decision, 'Pending');
  assert.equal(res.reason, '');
  assert.equal(res.overdueEvaluated, false);
});

test('refusal branch 1: invalid time (past start or end before start)', () => {
  const pastRes = evaluateRequest({
    ...baseInput(),
    startUtc: '2026-11-12T10:00:00.000Z',
    endUtc: '2026-11-12T12:00:00.000Z'
  });
  assert.equal(pastRes.decision, 'Declined');
  assert.equal(pastRes.reason, 'Refused automatically: the requested time is not valid.');

  const invertedRes = evaluateRequest({
    ...baseInput(),
    startUtc: '2026-11-13T16:00:00.000Z',
    endUtc: '2026-11-13T14:00:00.000Z'
  });
  assert.equal(invertedRes.decision, 'Declined');
  assert.equal(invertedRes.reason, 'Refused automatically: the requested time is not valid.');
});

test('refusal branch 2: unknown facility', () => {
  const res = evaluateRequest({
    ...baseInput(),
    facilityId: 'unknown-facility-id'
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: unknown facility.');
});

test('refusal branch 3: inactive membership', () => {
  const res = evaluateRequest({
    ...baseInput(),
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }]
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: this membership is not active.');

  const missingRes = evaluateRequest({
    ...baseInput(),
    memberships: []
  });
  assert.equal(missingRes.decision, 'Declined');
  assert.equal(missingRes.reason, 'Refused automatically: this membership is not active.');
});

test('refusal branch 4: private event overlap', () => {
  const res = evaluateRequest({
    ...baseInput(),
    privateEventOverlap: true
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: the facility is booked for a private event at this time.');
});

test('refusal branch 5: expired document', () => {
  const res = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-10', supersededBy: null }]
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: a required document has expired. The Flavors owner can override.');
});

test('refusal branch 6: equipment empty for Kitchen', () => {
  const res = evaluateRequest({
    ...baseInput(),
    space: 'Kitchen',
    equipmentIds: []
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');
});

test('refusal branch 7: unknown equipment', () => {
  const res = evaluateRequest({
    ...baseInput(),
    equipmentIds: ['rogue-eq']
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');
});

test('refusal branch 8: overdue is true', () => {
  const res = evaluateRequest({
    ...baseInput(),
    overdue: true
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: an overdue balance blocks new bookings. The Flavors owner can override.');
  assert.equal(res.overdueEvaluated, true);
});

test('two refusals at once returns the first by rule order', () => {
  // Both bad time (rule 2) and unknown facility (rule 3)
  const res1 = evaluateRequest({
    ...baseInput(),
    startUtc: '2026-11-10T10:00:00.000Z',
    facilityId: 'wrong-fac'
  });
  assert.equal(res1.reason, 'Refused automatically: the requested time is not valid.');

  // Unknown facility (rule 3) and inactive membership (rule 4)
  const res2 = evaluateRequest({
    ...baseInput(),
    facilityId: 'wrong-fac',
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }]
  });
  assert.equal(res2.reason, 'Refused automatically: unknown facility.');

  // Inactive membership (rule 4) and equipment empty (rule 5)
  const res3 = evaluateRequest({
    ...baseInput(),
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }],
    space: 'Kitchen',
    equipmentIds: []
  });
  assert.equal(res3.reason, 'Refused automatically: this membership is not active.');
});

test('staff vs non-staff with onBehalfOf', () => {
  const staffInput = {
    ...baseInput(),
    onBehalfOf: ' member@flavors.com ',
    requesterIsStaff: true
  };
  const staffRes = evaluateRequest(staffInput);
  assert.equal(staffRes.decision, 'Approved');
  assert.equal(staffRes.reason, '');

  const nonStaffInput = {
    ...baseInput(),
    onBehalfOf: 'member@flavors.com',
    requesterIsStaff: false
  };
  const nonStaffRes = evaluateRequest(nonStaffInput);
  assert.equal(nonStaffRes.decision, 'Declined');
  assert.equal(nonStaffRes.reason, 'Refused automatically: only Flavors staff can book for another member.');
});

test('non-staff with onBehalfOf -> Declined with rule-1 text even if everything else is valid', () => {
  const res = evaluateRequest({
    ...baseInput(),
    onBehalfOf: 'other@flavors.com',
    requesterIsStaff: false,
    memberships: [
      { memberId: 'member@flavors.com', status: 'Active' },
      { memberId: 'other@flavors.com', status: 'Active' }
    ]
  });
  assert.equal(res.decision, 'Declined');
  assert.equal(res.reason, 'Refused automatically: only Flavors staff can book for another member.');
});

test('staff with onBehalfOf and everything valid -> Approved', () => {
  const res = evaluateRequest({
    ...baseInput(),
    onBehalfOf: 'other@flavors.com',
    requesterIsStaff: true,
    memberships: [
      { memberId: 'member@flavors.com', status: 'Active' },
      { memberId: 'other@flavors.com', status: 'Active' }
    ]
  });
  assert.equal(res.decision, 'Approved');
  assert.equal(res.reason, '');
});

test('every pair of adjacent rules: violates rule N and rule N+1 asserts rule N wins (6 pairs, rules 1-7)', () => {
  // Pair 1: Rule 1 vs Rule 2 (non-staff onBehalfOf vs invalid time)
  const pair1 = evaluateRequest({
    ...baseInput(),
    onBehalfOf: 'other@flavors.com',
    requesterIsStaff: false,
    startUtc: '2026-11-10T10:00:00.000Z' // past
  });
  assert.equal(pair1.reason, 'Refused automatically: only Flavors staff can book for another member.');

  // Pair 2: Rule 2 vs Rule 3 (invalid time vs unknown facility)
  const pair2 = evaluateRequest({
    ...baseInput(),
    startUtc: '2026-11-10T10:00:00.000Z',
    facilityId: 'bad-facility'
  });
  assert.equal(pair2.reason, 'Refused automatically: the requested time is not valid.');

  // Pair 3: Rule 3 vs Rule 4 (unknown facility vs inactive membership)
  const pair3 = evaluateRequest({
    ...baseInput(),
    facilityId: 'bad-facility',
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }]
  });
  assert.equal(pair3.reason, 'Refused automatically: unknown facility.');

  // Pair 4: Rule 4 vs Rule 5 (membership inactive vs kitchen empty equipment)
  const pair4 = evaluateRequest({
    ...baseInput(),
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }],
    space: 'Kitchen',
    equipmentIds: []
  });
  assert.equal(pair4.reason, 'Refused automatically: this membership is not active.');

  // Pair 5: Rule 5 vs Rule 6 (kitchen empty equipment vs expired document)
  const pair5 = evaluateRequest({
    ...baseInput(),
    space: 'Kitchen',
    equipmentIds: [],
    documents: [{ expiryDate: '2026-11-01', supersededBy: null }]
  });
  assert.equal(pair5.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');

  // Pair 6: Rule 6 vs Rule 7 (expired document vs private event overlap)
  const pair6 = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-01', supersededBy: null }],
    privateEventOverlap: true
  });
  assert.equal(pair6.reason, 'Refused automatically: a required document has expired. The Flavors owner can override.');
});

test('membership active count: two Active records -> rule 4 text; zero records -> rule 4 text', () => {
  // Two active records for member
  const twoRecords = evaluateRequest({
    ...baseInput(),
    memberships: [
      { memberId: 'member@flavors.com', status: 'Active' },
      { memberId: 'member@flavors.com', status: 'Active' }
    ]
  });
  assert.equal(twoRecords.decision, 'Declined');
  assert.equal(twoRecords.reason, 'Refused automatically: this membership is not active.');

  // Zero records
  const zeroRecords = evaluateRequest({
    ...baseInput(),
    memberships: []
  });
  assert.equal(zeroRecords.decision, 'Declined');
  assert.equal(zeroRecords.reason, 'Refused automatically: this membership is not active.');
});

test('Kitchen with empty equipment, and Kitchen/Dining with an unknown id -> the single rule-5 text', () => {
  // Kitchen empty
  const kEmpty = evaluateRequest({
    ...baseInput(),
    space: 'Kitchen',
    equipmentIds: []
  });
  assert.equal(kEmpty.decision, 'Declined');
  assert.equal(kEmpty.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');

  // Kitchen with unknown id
  const kUnknown = evaluateRequest({
    ...baseInput(),
    space: 'Kitchen',
    equipmentIds: ['non-existent-equip']
  });
  assert.equal(kUnknown.decision, 'Declined');
  assert.equal(kUnknown.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');

  // Dining with unknown id
  const dUnknown = evaluateRequest({
    ...baseInput(),
    space: 'Dining',
    equipmentIds: ['non-existent-equip']
  });
  assert.equal(dUnknown.decision, 'Declined');
  assert.equal(dUnknown.reason, 'Refused automatically: choose equipment from the Flavors equipment list.');
});

test('expired-but-superseded does not block', () => {
  const res = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-01', supersededBy: 'sub-new-123' }]
  });
  assert.equal(res.decision, 'Pending');
  assert.equal(res.reason, '');
});

test('document expiry date comparison: exactly today vs yesterday', () => {
  // Today in UTC is 2026-11-13
  const todayRes = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-13', supersededBy: null }]
  });
  assert.equal(todayRes.decision, 'Pending');

  const yesterdayRes = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-12', supersededBy: null }]
  });
  assert.equal(yesterdayRes.decision, 'Declined');
  assert.equal(yesterdayRes.reason, 'Refused automatically: a required document has expired. The Flavors owner can override.');
});

test('override lifts only the document block', () => {
  // Expired document with active override -> unblocked
  const docWithOverride = evaluateRequest({
    ...baseInput(),
    documents: [{ expiryDate: '2026-11-10', supersededBy: null }],
    activeOverrideForMember: true
  });
  assert.equal(docWithOverride.decision, 'Pending');

  // Override does NOT lift inactive membership
  const inactiveWithOverride = evaluateRequest({
    ...baseInput(),
    memberships: [{ memberId: 'member@flavors.com', status: 'Inactive' }],
    activeOverrideForMember: true
  });
  assert.equal(inactiveWithOverride.decision, 'Declined');
  assert.equal(inactiveWithOverride.reason, 'Refused automatically: this membership is not active.');

  // Override does NOT lift private event overlap
  const overlapWithOverride = evaluateRequest({
    ...baseInput(),
    privateEventOverlap: true,
    activeOverrideForMember: true
  });
  assert.equal(overlapWithOverride.decision, 'Declined');
  assert.equal(overlapWithOverride.reason, 'Refused automatically: the facility is booked for a private event at this time.');
});

test('overdue true, false, and undefined', () => {
  const resUndef = evaluateRequest({ ...baseInput(), overdue: undefined });
  assert.equal(resUndef.decision, 'Pending');
  assert.equal(resUndef.overdueEvaluated, false);

  const resFalse = evaluateRequest({ ...baseInput(), overdue: false });
  assert.equal(resFalse.decision, 'Pending');
  assert.equal(resFalse.overdueEvaluated, true);

  const resTrue = evaluateRequest({ ...baseInput(), overdue: true });
  assert.equal(resTrue.decision, 'Declined');
  assert.equal(resTrue.overdueEvaluated, true);
});

test('email case and whitespace normalization', () => {
  const res = evaluateRequest({
    ...baseInput(),
    requesterEmail: '   MEMBER@FLAVORS.COM  ',
    memberships: [{ memberId: 'member@flavors.com', status: 'Active' }]
  });
  assert.equal(res.decision, 'Pending');

  const onBehalfRes = evaluateRequest({
    ...baseInput(),
    onBehalfOf: '  MEMBER@FLAVORS.COM  ',
    requesterIsStaff: true,
    memberships: [{ memberId: 'member@flavors.com', status: 'Active' }]
  });
  assert.equal(onBehalfRes.decision, 'Approved');
});

test('equipment not required for Dining or Whole facility', () => {
  const diningRes = evaluateRequest({
    ...baseInput(),
    space: 'Dining',
    equipmentIds: []
  });
  assert.equal(diningRes.decision, 'Pending');

  const wholeRes = evaluateRequest({
    ...baseInput(),
    space: 'Whole facility',
    equipmentIds: []
  });
  assert.equal(wholeRes.decision, 'Pending');
});

test('hardening M6: Declined always has non-empty reason; Approved and Pending never do (500 cases)', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(777666555);

  for (let i = 0; i < 500; i++) {
    const isStaff = rng() > 0.5;
    const hasOnBehalf = rng() > 0.5;
    const isKitchen = rng() > 0.3;
    const isPastTime = rng() > 0.8;
    const badFac = rng() > 0.85;
    const inactive = rng() > 0.8;
    const privateOverlap = rng() > 0.85;
    const docExpired = rng() > 0.8;
    const hasOverride = rng() > 0.5;
    const unknownEquip = rng() > 0.85;
    const emptyEquip = rng() > 0.8;
    const overdueVal = rng() > 0.7 ? (rng() > 0.5 ? true : false) : undefined;

    const input = {
      requesterEmail: 'test@example.com',
      onBehalfOf: hasOnBehalf ? 'behalf@example.com' : undefined,
      requesterIsStaff: isStaff,
      facilityId: badFac ? 'other-fac' : 'flavors-hyattsville',
      space: isKitchen ? 'Kitchen' : 'Dining',
      equipmentIds: emptyEquip ? [] : (unknownEquip ? ['unknown-eq'] : ['eq-1']),
      knownActiveEquipmentIds: ['eq-1'],
      startUtc: isPastTime ? '2026-11-10T10:00:00Z' : VALID_START,
      endUtc: VALID_END,
      nowUtc: NOW_UTC,
      memberships: [
        { memberId: 'test@example.com', status: inactive ? 'Inactive' : 'Active' },
        { memberId: 'behalf@example.com', status: inactive ? 'Inactive' : 'Active' }
      ],
      documents: [{ expiryDate: docExpired ? '2026-11-01' : '2026-12-01', supersededBy: null }],
      activeOverrideForMember: hasOverride,
      privateEventOverlap: privateOverlap,
      overdue: overdueVal
    };

    const res = evaluateRequest(input);
    if (res.decision === 'Declined') {
      assert(typeof res.reason === 'string' && res.reason.length > 0, `Declined must have non-empty reason, got "${res.reason}"`);
    } else if (res.decision === 'Approved' || res.decision === 'Pending') {
      assert.equal(res.reason, '', `${res.decision} must have empty reason, got "${res.reason}"`);
    } else {
      assert.fail(`Invalid decision: ${res.decision}`);
    }
  }
});

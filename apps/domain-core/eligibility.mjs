// Booking request eligibility reference model for Avenue Phase 1
// Pure function: no clock reading, no external state, no side effects.
// Refusal rules and strings match flows/expressions.md and docs/DATA_AND_ACCESS.md section 2.

/**
 * Evaluates a booking request against eligibility and refusal rules.
 *
 * @param {Object} input
 * @param {string} input.requesterEmail
 * @param {string} [input.onBehalfOf]
 * @param {boolean} input.requesterIsStaff
 * @param {string} input.facilityId
 * @param {"Kitchen"|"Dining"|"Whole facility"} input.space
 * @param {Array<string>} input.equipmentIds
 * @param {Array<string>} input.knownActiveEquipmentIds
 * @param {string} input.startUtc - ISO string
 * @param {string} input.endUtc - ISO string
 * @param {string} input.nowUtc - ISO string
 * @param {Array<{memberId: string, status: string}>} input.memberships
 * @param {Array<{expiryDate: string, supersededBy: (string|null)}>} input.documents
 * @param {boolean} input.activeOverrideForMember
 * @param {boolean} input.privateEventOverlap
 * @param {boolean|undefined} input.overdue
 * @returns {{decision: "Pending"|"Approved"|"Declined", reason: string, overdueEvaluated: boolean}}
 */
export function evaluateRequest(input) {
  const {
    requesterEmail,
    onBehalfOf,
    requesterIsStaff,
    facilityId,
    space,
    equipmentIds = [],
    knownActiveEquipmentIds = [],
    startUtc,
    endUtc,
    nowUtc,
    memberships = [],
    documents = [],
    activeOverrideForMember = false,
    privateEventOverlap = false,
    overdue
  } = input;

  const onBehalfOfTrimmed = typeof onBehalfOf === 'string' && onBehalfOf.trim() !== ''
    ? onBehalfOf.trim().toLowerCase()
    : null;

  const evaluatedMember = onBehalfOfTrimmed || (typeof requesterEmail === 'string' ? requesterEmail.trim().toLowerCase() : '');

  const overdueEvaluated = typeof overdue === 'boolean';

  // Rule 1: onBehalfOf present (non-empty after trim) AND requesterIsStaff is false
  if (onBehalfOfTrimmed !== null && !requesterIsStaff) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: only Flavors staff can book for another member.',
      overdueEvaluated
    };
  }

  // Rule 2: end <= start, or start < now, (or any of the three timestamps unparsable)
  const startMs = Date.parse(startUtc);
  const endMs = Date.parse(endUtc);
  const nowMs = Date.parse(nowUtc);

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(nowMs) || endMs <= startMs || startMs < nowMs) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: the requested time is not valid.',
      overdueEvaluated
    };
  }

  // Rule 3: facilityId !== "flavors-hyattsville"
  if (facilityId !== 'flavors-hyattsville') {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: unknown facility.',
      overdueEvaluated
    };
  }

  // Rule 4: The evaluated member does not have EXACTLY ONE membership record with status "Active"
  // (zero records, or two or more records, or one that is not Active)
  const memberRecords = (memberships || []).filter(
    (m) => m && typeof m.memberId === 'string' && m.memberId.trim().toLowerCase() === evaluatedMember
  );
  const activeRecords = memberRecords.filter((m) => m.status === 'Active');

  if (memberRecords.length !== 1 || activeRecords.length !== 1) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: this membership is not active.',
      overdueEvaluated
    };
  }

  // Rule 5: (space === "Kitchen" AND equipmentIds is empty/blank) OR any equipment id is not in knownActiveEquipmentIds
  const activeSet = new Set(knownActiveEquipmentIds || []);
  const cleanEquipmentIds = Array.isArray(equipmentIds)
    ? equipmentIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter((id) => id !== '')
    : [];

  const kitchenEmpty = space === 'Kitchen' && cleanEquipmentIds.length === 0;
  const hasUnknownEquipment = cleanEquipmentIds.some((id) => !activeSet.has(id));

  if (kitchenEmpty || hasUnknownEquipment) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: choose equipment from the Flavors equipment list.',
      overdueEvaluated
    };
  }

  // Rule 6: At least one unsuperseded document with expiryDate < today's UTC date AND no active override
  const todayUtc = typeof nowUtc === 'string' ? nowUtc.substring(0, 10) : '';
  const hasExpiredUnrenewed = documents.some((doc) => {
    if (!doc || !doc.expiryDate) return false;
    const isSuperseded = doc.supersededBy !== null && doc.supersededBy !== undefined && doc.supersededBy !== '';
    if (isSuperseded) return false;
    return doc.expiryDate < todayUtc;
  });

  if (hasExpiredUnrenewed && !activeOverrideForMember) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: a required document has expired. The Flavors owner can override.',
      overdueEvaluated
    };
  }

  // Rule 7: privateEventOverlap is true
  if (privateEventOverlap) {
    return {
      decision: 'Declined',
      reason: 'Refused automatically: the facility is booked for a private event at this time.',
      overdueEvaluated
    };
  }

  // Overdue check (Q-07 is OPEN): evaluated AFTER rule 7
  if (overdue === true) {
    // [PROPOSED TEXT]
    return {
      decision: 'Declined',
      reason: 'Refused automatically: an overdue balance blocks new bookings. The Flavors owner can override.',
      overdueEvaluated
    };
  }

  // No refusal applies:
  // Decision: "Approved" if onBehalfOf is present AND requesterIsStaff, else "Pending"
  if (onBehalfOfTrimmed && requesterIsStaff) {
    return {
      decision: 'Approved',
      reason: '',
      overdueEvaluated
    };
  }

  return {
    decision: 'Pending',
    reason: '',
    overdueEvaluated
  };
}

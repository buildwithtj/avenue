// Event and dining cancellation refund outcome for Avenue Phase 1
// Pure function: no money amounts, no interpolation, no external state.
// As per docs/REQUIREMENTS.md row BKG-11 and docs/DECISIONS_AND_OPEN_QUESTIONS.md row Q-08,
// client policy is confirmed ONLY for 15+ days and exactly 7 days.
// All other notice intervals (0-6 days and 8-14 days) are OPEN under Q-08.

/**
 * Returns the cancellation refund outcome based on days of notice given.
 *
 * @param {number} noticeDays - Whole number >= 0
 * @returns {{status: "full-refund" | "forfeit-deposit-and-payments" | "policy-undefined", question?: string}}
 */
export function eventRefundOutcome(noticeDays) {
  if (
    typeof noticeDays !== 'number' ||
    !Number.isInteger(noticeDays) ||
    noticeDays < 0
  ) {
    throw new Error(
      `noticeDays must be a whole number >= 0, received: ${JSON.stringify(noticeDays)}`
    );
  }

  // 15+ days notice -> full refund confirmed
  if (noticeDays >= 15) {
    return { status: 'full-refund' };
  }

  // Exactly 7 days notice -> forfeit deposit and payments confirmed
  if (noticeDays === 7) {
    return { status: 'forfeit-deposit-and-payments' };
  }

  // All other intervals (0-6 days and 8-14 days) are unresolved in client policy (Q-08)
  return {
    status: 'policy-undefined',
    question: 'Q-08'
  };
}

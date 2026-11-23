// Entry and exit checklists (CHK-01). The questions come from AvenueChecklistQuestions, which Flavors maintains;
// the question set and pass/fail criteria are still open (Q-10). [PROPOSED] A checklist "passes" when every answer is
// Yes; staff see every answer either way, and no automatic consequence follows from a fail (CHK-05).

import type { CheckInKind, IChecklistQuestion } from './contracts';

export type Answer = 'Yes' | 'No';

export interface ICheckInInput {
  facilityId: string;
  bookingId: string;
  kind: CheckInKind;
  answers: Record<number, Answer>;
  /** Wellness only (Q-M6 default): the team member these answers belong to; the lead's account sends it. */
  personName?: string;
}

export function validateCheckIn(input: ICheckInInput, questions: IChecklistQuestion[]): string[] {
  const relevant: IChecklistQuestion[] = questions.filter(q => q.kind === input.kind);
  const errors: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.bookingId)) {
    errors.push('Choose one of your approved bookings.');
  }
  const name: string = (input.personName || '').trim();
  if (input.kind === 'Wellness' && (name.length < 2 || name.length > 80)) {
    errors.push('Enter the team member\'s name (2 to 80 characters).');
  }
  if (relevant.length === 0) {
    errors.push('Flavors has not set up this checklist yet.');
  } else if (relevant.some(q => input.answers[q.id] !== 'Yes' && input.answers[q.id] !== 'No')) {
    errors.push('Answer every question.');
  }
  return errors;
}

/** The intake item. Answers are stored with the question text so the record stays readable if questions change. */
export function toCheckInItem(input: ICheckInInput, questions: IChecklistQuestion[], submissionId: string): Record<string, unknown> {
  const relevant: IChecklistQuestion[] = questions.filter(q => q.kind === input.kind).sort((a, b) => a.order - b.order);
  const answers: { q: string; a: Answer }[] = relevant.map(q => ({ q: q.text, a: input.answers[q.id] }));
  const person: string | undefined = input.kind === 'Wellness' ? (input.personName || '').trim() : undefined;
  return {
    Title: person ? `Wellness check: ${person}` : `${input.kind} checklist`,
    ...(person ? { PersonName: person } : {}),
    FacilityId: input.facilityId,
    SubmissionId: submissionId,
    BookingId: input.bookingId,
    Kind: input.kind,
    Answers: JSON.stringify(answers),
    AllPassed: answers.every(x => x.a === 'Yes')
  };
}

import { actionItems, facilityDayLabel as dayLabel, dateParts, dateState, documentCards, reviewState, hoursSummary, isBookingBlocked, newestPerType, pickNextBooking, relativeDay } from './home';
import type { IMyDocumentSubmission, IMyRequest } from './contracts';

const TZ = 'America/New_York';
const NOW = Date.parse('2026-11-14T15:00:00Z'); // 10:00 AM Eastern, Sat 14 Nov

function req(id: string, startUtc: string, endUtc: string, status?: IMyRequest['status'], extra: Partial<IMyRequest> = {}): IMyRequest {
  return { requestId: id, space: 'Kitchen', startUtc, endUtc, cancelSent: false, cancelRequested: false, status, ...extra };
}
function doc(id: string, docType: IMyDocumentSubmission['docType'], expiryDate: string): IMyDocumentSubmission {
  return { submissionId: id, docType, issueDate: '2025-01-01', expiryDate };
}

describe('pickNextBooking', () => {
  it('prefers one in progress, then the soonest approved, then the soonest waiting', () => {
    const running = req('a', '2026-11-14T14:00:00Z', '2026-11-14T18:00:00Z', 'Approved');
    const later = req('b', '2026-11-16T14:00:00Z', '2026-11-16T18:00:00Z', 'Approved');
    const sooner = req('c', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Approved');
    const wait = req('d', '2026-11-14T20:00:00Z', '2026-11-14T22:00:00Z', 'Pending');
    expect(pickNextBooking([later, sooner, wait, running], NOW)).toEqual({ request: running, phase: 'in-progress' });
    expect(pickNextBooking([later, sooner, wait], NOW)).toEqual({ request: sooner, phase: 'upcoming' });
    expect(pickNextBooking([wait], NOW)).toEqual({ request: wait, phase: 'waiting' });
  });
  it('ignores finished, declined and cancelled bookings; keeps one with a cancel request until it is cancelled', () => {
    const past = req('p', '2026-11-13T14:00:00Z', '2026-11-13T18:00:00Z', 'Approved');
    const declined = req('x', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Declined');
    const cancelled = req('y', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Cancelled');
    const sent = req('z', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Approved', { cancelSent: true });
    expect(pickNextBooking([past, declined, cancelled], NOW)).toBeUndefined();
    // Asking to cancel does not cancel: the booking stands until staff (or the 24 h rule) mark it Cancelled.
    expect(pickNextBooking([past, declined, cancelled, sent], NOW)?.request.requestId).toBe('z');
    expect(pickNextBooking([], NOW)).toBeUndefined();
  });
  it('treats a request the flow has not processed yet (no status) as waiting', () => {
    const fresh = req('f', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z');
    expect(pickNextBooking([fresh], NOW)?.phase).toBe('waiting');
  });
  it('a booking ending exactly now is over', () => {
    expect(pickNextBooking([req('e', '2026-11-14T11:00:00Z', new Date(NOW).toISOString(), 'Approved')], NOW)).toBeUndefined();
  });
});

describe('actionItems', () => {
  it('names the expired document, what it prevents and how to renew', () => {
    const items = actionItems([doc('1', 'Permit', '2026-11-01')], [], '2026-11-14');
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('document-expired');
    expect(items[0].title).toBe('Your Permit expired on Nov 1, 2026');
    expect(items[0].consequence).toMatch(/cannot book/);
    expect(items[0].howTo).toMatch(/Upload/);
    expect(isBookingBlocked(items)).toBe(true);
  });
  it('a newer submission of the same type replaces the stale expiry', () => {
    const items = actionItems([doc('1', 'Permit', '2026-11-01'), doc('2', 'Permit', '2027-11-01')], [], '2026-11-14');
    expect(items).toEqual([]);
    expect(isBookingBlocked(items)).toBe(false);
  });
  it('flags a document expiring before day 30 (same rule as the earlier Home screen); expiry today is not yet expired', () => {
    expect(actionItems([doc('1', 'Licence', '2026-12-13')], [], '2026-11-14')[0].kind).toBe('document-expiring');
    expect(actionItems([doc('1', 'Licence', '2026-12-14')], [], '2026-11-14')).toEqual([]);
    expect(actionItems([doc('1', 'Licence', '2026-11-14')], [], '2026-11-14')[0].kind).toBe('document-expiring');
  });
  it('expired items sort before expiring and a pending cancellation sits between', () => {
    const items = actionItems(
      [doc('1', 'Insurance', '2026-11-20'), doc('2', 'Permit', '2026-11-01')],
      [req('r', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Approved', { cancelRequested: true })], '2026-11-14');
    expect(items.map(i => i.kind)).toEqual(['document-expired', 'cancel-pending', 'document-expiring']);
  });
  it('does not show a cancellation action once it is Cancelled', () => {
    expect(actionItems([], [req('r', '2026-11-15T14:00:00Z', '2026-11-15T18:00:00Z', 'Cancelled', { cancelRequested: true })], '2026-11-14')).toEqual([]);
  });
  it('no documents means no document action', () => {
    expect(actionItems([], [], '2026-11-14')).toEqual([]);
  });
});

describe('dateParts and relativeDay use the facility time zone', () => {
  it('formats 02:00Z on the 15th as the evening of the 14th in New York', () => {
    expect(dateParts('2026-11-15T02:00:00Z', '2026-11-15T04:30:00Z', TZ)).toEqual({ weekday: 'Sat', day: '14', month: 'Nov', time: '9:00 PM – 11:30 PM' });
  });
  it('labels Today, Tomorrow and In N days by facility-local day', () => {
    expect(relativeDay('2026-11-14T23:00:00Z', NOW, TZ)).toBe('Today');
    expect(relativeDay('2026-11-15T14:00:00Z', NOW, TZ)).toBe('Tomorrow');
    expect(relativeDay('2026-11-17T14:00:00Z', NOW, TZ)).toBe('In 3 days');
    // 02:00Z on the 15th is still the 14th in New York
    expect(relativeDay('2026-11-15T02:00:00Z', NOW, TZ)).toBe('Today');
  });
});

describe('hoursSummary', () => {
  it('computes left, over and fraction', () => {
    expect(hoursSummary(4, 10)).toEqual({ used: 4, allowance: 10, left: 6, over: 0, fraction: 0.4 });
    expect(hoursSummary(12.5, 10)).toEqual({ used: 12.5, allowance: 10, left: 0, over: 2.5, fraction: 1 });
    expect(hoursSummary(10, 10).left).toBe(0);
  });
  it('does not invent an allowance when it is unknown, zero, negative or not finite', () => {
    for (const a of [undefined, 0, -5, NaN, Infinity]) {
      const s = hoursSummary(3, a as number | undefined);
      expect(s.allowance).toBeUndefined();
      expect(s.left).toBeUndefined();
      expect(s.over).toBe(0);
    }
  });
});

describe('document review state and cards', () => {
  it('maps the flow\'s own outcome text and never claims "verified"', () => {
    expect(reviewState('Uploading')).toEqual({ review: 'uploading' });
    expect(reviewState('Received. Flavors will verify it.')).toEqual({ review: 'received' });
    expect(reviewState('Already received')).toEqual({ review: 'received' });
    expect(reviewState('Not accepted: choose a document type and an expiry date after the issue date, then send it again').review).toBe('not-accepted');
    expect(reviewState(undefined)).toEqual({ review: 'processing' });
    expect(reviewState('Verified')).toEqual({ review: 'processing' });
  });
  it('dateState boundaries', () => {
    expect(dateState('2026-11-13', '2026-11-14')).toBe('expired');
    expect(dateState('2026-11-14', '2026-11-14')).toBe('expiring');
    expect(dateState('2026-12-13', '2026-11-14')).toBe('expiring');
    expect(dateState('2026-12-14', '2026-11-14')).toBe('current');
  });
  it('keeps the newest per type, most urgent first, older ones as history', () => {
    const docs = [doc('1', 'Permit', '2026-11-01'), doc('2', 'Permit', '2027-11-01'), doc('3', 'Insurance', '2026-11-20'), doc('4', 'Licence', '2026-10-01')];
    const { current, history } = documentCards(docs, '2026-11-14');
    expect(current.map(c => `${c.submission.docType}:${c.dateState}`)).toEqual(['Licence:expired', 'Insurance:expiring', 'Permit:current']);
    expect(history.map(h => h.submissionId)).toEqual(['1']);
  });
  it('a renewal that was received replaces the expired card and shows as awaiting verification', () => {
    const docs = [doc('1', 'Permit', '2026-11-01'), { ...doc('2', 'Permit', '2027-11-01'), outcome: 'Received. Flavors will verify it.' }];
    const { current } = documentCards(docs, '2026-11-14');
    expect(current).toHaveLength(1);
    expect(current[0].dateState).toBe('current');
    expect(current[0].review).toBe('received');
  });
  it('empty input gives empty output', () => {
    expect(documentCards([], '2026-11-14')).toEqual({ current: [], history: [] });
  });
});

describe('dayLabel', () => {
  it('labels today, tomorrow and other days', () => {
    expect(dayLabel('2026-11-14', '2026-11-14')).toBe('Today');
    expect(dayLabel('2026-11-15', '2026-11-14')).toBe('Tomorrow');
    expect(dayLabel('2026-11-16', '2026-11-14')).toBe('Mon, Nov 16');
    expect(dayLabel('2026-11-13', '2026-11-14')).toBe('Fri, Nov 13');
    expect(dayLabel('2027-01-01', '2026-12-31')).toBe('Tomorrow');
  });
});

describe('newestPerType', () => {
  const d2 = (id: string, expiryDate: string, outcome?: string): IMyDocumentSubmission => ({ ...doc(id, 'Permit', expiryDate), outcome });
  it('lets a failed upload not hide the real document', () => {
    expect(newestPerType([d2('real', '2026-01-01', 'Received. Flavors will verify it.'), d2('orphan', '2030-01-01', 'Uploading')]).get('Permit')!.submissionId).toBe('real');
  });
  it('still prefers the later expiry between real documents', () => {
    expect(newestPerType([d2('a', '2026-01-01', 'Received'), d2('b', '2027-01-01', 'Received')]).get('Permit')!.submissionId).toBe('b');
  });
});

import { checkInCountdown } from './checklist';
import { toCheckInItem, validateCheckIn } from './checkin';
import type { IChecklistQuestion } from './contracts';

const Q: IChecklistQuestion[] = [{ id: 4, kind: 'Wellness', text: 'Feeling well?', order: 1 }, { id: 1, kind: 'Entry', text: 'Clean?', order: 1 }];

describe('wellness check-in', () => {
  it('needs a person name and only the wellness questions', () => {
    const base = { facilityId: 'f', bookingId: 'b1', kind: 'Wellness' as const, answers: { 4: 'Yes' as const } };
    expect(validateCheckIn(base, Q)).toEqual(['Enter the team member\'s name (2 to 80 characters).']);
    expect(validateCheckIn({ ...base, personName: 'Ana' }, Q)).toEqual([]);
  });
  it('records the person on its own item, answers with question text', () => {
    const item = toCheckInItem({ facilityId: 'f', bookingId: 'b1', kind: 'Wellness', answers: { 4: 'No' }, personName: ' Ana ' }, Q, 's1');
    expect(item).toMatchObject({ Kind: 'Wellness', PersonName: 'Ana', Title: 'Wellness check: Ana', AllPassed: false });
    expect(JSON.parse(item.Answers as string)).toEqual([{ q: 'Feeling well?', a: 'No' }]);
    expect(toCheckInItem({ facilityId: 'f', bookingId: 'b1', kind: 'Entry', answers: { 1: 'Yes' } }, Q, 's2').PersonName).toBeUndefined();
  });
  it('counts down only inside the window (30 min before to 10 min after the start)', () => {
    const start = '2026-11-21T15:00:00Z';
    const at = (iso: string): number => Date.parse(iso);
    expect(checkInCountdown(start, at('2026-11-21T14:29:00Z'))).toBeUndefined();
    expect(checkInCountdown(start, at('2026-11-21T14:30:00Z'))).toBe(40);
    expect(checkInCountdown(start, at('2026-11-21T15:02:30Z'))).toBe(8);
    expect(checkInCountdown(start, at('2026-11-21T15:10:00Z'))).toBe(0);
    expect(checkInCountdown(start, at('2026-11-21T15:10:01Z'))).toBeUndefined();
    expect(checkInCountdown('nope', 0)).toBeUndefined();
  });
});

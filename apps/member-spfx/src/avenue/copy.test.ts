import type { IFacility, IResource } from './contracts';
import { type ISelectionInput, buildBusyMap, validateSelection } from './availability';
import {
  approvalNote, bookedTimeLine, cancellationNote, cleaningLine, cleaningRule, conflictMessages, earlyEntryLine, earlyEntryRule, endBannerText,
  detailLines, endReminderMessage, endReminderSubject, hoursNote, lengthText, noPaymentNote, phaseLine, selectionMessages, timeLines
} from './copy';

const TZ = 'America/New_York';
const F: IFacility = { facilityId: 'f', title: 'F', timeZone: TZ, earlyEntryMinutes: 30, cleanupMinutes: 30, checkoutAlertMinutes: 30 };
const NONE: IFacility = { facilityId: 'f', title: 'F', timeZone: TZ };
const B = { startUtc: '2026-10-14T19:00:00Z', endUtc: '2026-10-14T21:00:00Z' }; // 3-5 PM EDT
const min = (iso: string, m: number): number => Date.parse(iso) + m * 60000;

describe('window copy', () => {
  it('uses the facility numbers', () => {
    expect(earlyEntryRule(F)).toContain('30 minutes early');
    expect(earlyEntryLine(B, F)).toBe('Entry from 2:30 PM.');
    expect(bookedTimeLine(B, F)).toBe('Booked 3:00 PM to 5:00 PM (2 h).');
    expect(cleaningRule(F)).toContain('30 minutes to clean');
    expect(cleaningLine(B, F)).toBe('Clean-up until 5:30 PM, free.');
    expect(timeLines(B, F).early).toBe('Entry from 2:30 PM.');
    expect(hoursNote(F)).toBe('Only booked time uses hours.');
  });
  it('omits numbers when settings are undefined', () => {
    for (const s of [earlyEntryRule(NONE), earlyEntryLine(B, NONE).replace('3:00 PM', ''), cleaningRule(NONE), cleaningLine(B, NONE).replace('5:00 PM', ''), hoursNote(NONE)]) {
      expect(s).not.toMatch(/\d/);
    }
  });
  it('approval, payment and cancellation notes', () => {
    expect(approvalNote()).toMatch(/confirms by e-mail/);
    expect(noPaymentNote()).toMatch(/Nothing is charged/);
    expect(cancellationNote()).toContain('24 h');
    for (const s of [approvalNote(), noPaymentNote(), cancellationNote()]) { expect(s).not.toMatch(/cannot be placed|Add to booking|Continue/); }
  });
});

describe('long wording', () => {
  it('keeps the full sentences with the facility numbers for More details', () => {
    const l = detailLines(F).join(' ');
    expect(l).toContain('30 minutes before your start time');
    expect(l).toContain('30 minutes after your end time');
    expect(l).toContain('24 hours');
  });
});

describe('end reminder copy', () => {
  it('matches the client wording', () => {
    expect(endReminderSubject(B, F)).toBe('Your Flavors booking ends at 5:00 PM');
    expect(endReminderMessage(B, F)).toBe('Your booking ends at 5:00 PM. Please start cleaning now. You can stay until 5:30 PM for cleaning (not charged). Need more time? Extend.');
    expect(endReminderMessage(B, NONE)).toBe('Your booking ends at 5:00 PM. Please start cleaning now. Need more time? Extend.');
  });
  it('banner', () => {
    expect(endBannerText(B, F, min(B.endUtc, -28))).toBe('Time to clean up. Ends in 28 min. Extend.');
    expect(endBannerText(B, F, min(B.endUtc, 5))).toBe('');
  });
});

describe('phaseLine', () => {
  it('one line per phase', () => {
    expect(phaseLine(B, F, min(B.startUtc, -130))).toBe('Starts in 2 h 10 min');
    expect(phaseLine(B, F, min(B.startUtc, -10))).toBe('You can come in now. Booked time starts at 3:00 PM.');
    expect(phaseLine(B, F, min(B.startUtc, 60))).toBe('In the kitchen until 5:00 PM.');
    expect(phaseLine(B, F, min(B.endUtc, -28))).toBe('Ends in 28 min. Time to clean up.');
    expect(phaseLine(B, F, min(B.endUtc, 5))).toBe('Cleaning time. Leave by 5:30 PM.');
    expect(phaseLine(B, F, min(B.endUtc, 45))).toBe('Finished.');
  });
});

describe('conflict suggestions', () => {
  const U = (id: string, title: string, category: IResource['category'], sortOrder: number): IResource => ({ resourceId: id, title, kind: category === 'Prep table' ? 'Prep table' : 'Equipment', category, sortOrder, bookable: true });
  const units = [U('s1', 'Stove #1', 'Stove', 1), U('s2', 'Stove #2', 'Stove', 2), U('p1', 'Prep table 1', 'Prep table', 1), U('p2', 'Prep table 2', 'Prep table', 2)];
  const day = '2026-10-14';
  const held = (ids: string[], s: string, e: string): ReturnType<typeof buildBusyMap> => buildBusyMap([{ bookingId: 'x', resourceId: '', space: 'Kitchen', equipmentIds: ids, memberName: 'Other', startUtc: `${day}T${s}Z`, endUtc: `${day}T${e}Z` }]);
  const input = (busy: ReturnType<typeof buildBusyMap>, unitIds: string[] = ['s1']): ISelectionInput => ({
    mode: 'equipment', unitIds, prepTableCount: 2, startUtc: `${day}T19:00:00Z`, endUtc: `${day}T21:00:00Z`, units, busy, facility: { ...F, minPrepTables: 2 }, nowMs: Date.parse('2026-10-01T00:00:00Z')
  });

  it('suggests a later time and another unit', () => {
    const i = input(held(['s1'], '17:00:00', '20:00:00'));
    const r = validateSelection(i);
    expect(conflictMessages(i, r)).toEqual(['Stove #1 is busy until 4:00 PM. Try 4:00 PM, or use Stove #2.']);
  });
  it('suggestions skip a busy alternative and a later slot that is also taken', () => {
    const i = input(buildBusyMap([
      { bookingId: 'x', resourceId: '', space: 'Kitchen', equipmentIds: ['s1', 's2'], memberName: 'A', startUtc: `${day}T17:00:00Z`, endUtc: `${day}T20:00:00Z` },
      { bookingId: 'y', resourceId: '', space: 'Kitchen', equipmentIds: ['s1'], memberName: 'B', startUtc: `${day}T20:00:00Z`, endUtc: `${day}T22:00:00Z` }
    ]));
    const r = validateSelection(i);
    // busy until 6 PM local (chained 20:00-22:00Z); alternatives none (Stove #2 busy)
    expect(conflictMessages(i, r)).toEqual(['Stove #1 is busy until 6:00 PM. Try 6:00 PM.']);
  });
  it('says choose another time when nothing is suggested', () => {
    const i = input(held(['s1'], '00:00:00', '23:59:00'));
    const r = validateSelection({ ...i, unitIds: ['s1', 's2'] });
    const msgs = conflictMessages({ ...i, unitIds: ['s1', 's2'] }, r);
    expect(msgs[0]).toMatch(/^Stove #1 is busy until/);
  });
  it('selectionMessages replaces the conflict sentence and keeps the other problems', () => {
    const i = { ...input(held(['s1'], '17:00:00', '20:00:00')), prepTableCount: 1 };
    const msgs = selectionMessages(i, validateSelection(i));
    expect(msgs.filter(m => /busy until/.test(m)).length).toBe(1);
    expect(msgs.some(m => /booked until/.test(m))).toBe(false);
    expect(msgs.some(m => /at least 2 prep tables/.test(m))).toBe(true);
  });
  it('length text only when defined', () => {
    expect(lengthText(NONE, 5)).toBe('');
    expect(lengthText({ ...NONE, minBookingMinutes: 60 }, 30)).toBe('Make it at least 1 hour long.');
  });
});

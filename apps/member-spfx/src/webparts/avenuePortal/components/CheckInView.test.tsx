/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import CheckInView from './CheckInView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hour = 3600 * 1000;
const booking = { requestId: 'r1', space: 'Kitchen', startUtc: new Date(Date.now() + hour).toISOString(), endUtc: new Date(Date.now() + 3 * hour).toISOString(), status: 'Approved', cancelSent: false, cancelRequested: false, equipmentIds: [] };
const questions = [{ id: 9, kind: 'Wellness', text: 'Well?', order: 1 }, { id: 3, kind: 'Exit', text: 'Locked?', order: 1 }, { id: 1, kind: 'Entry', text: 'Clean?', order: 1 }, { id: 2, kind: 'Entry', text: 'Healthy?', order: 2 }];
function source(sent: unknown[], history: unknown[] = []): never {
  return {
    listMyRequests: async () => [booking], listChecklistQuestions: async () => questions, listMyCheckIns: async () => history,
    submitCheckIn: async (input: unknown) => { sent.push(input); }
  } as never;
}
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };

describe('CheckInView journey', () => {
  it('guided stepper: one question at a time, review step, then send', async () => {
    const sent: unknown[] = [];
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CheckInView source={source(sent)} facility={{ facilityId: 'f', title: 'F', timeZone: 'America/New_York' }} />); });
    await flush();
    expect(host.querySelector('#q-1')?.textContent).toBe('Clean?');
    expect(host.querySelector('#q-2')).toBeNull();                 // only the current question is shown
    expect(host.textContent).toContain('Question 1 of 2');
    expect(Array.from(host.querySelectorAll('button')).some(b => /Send checklist/.test(b.textContent || ''))).toBe(false);
    await act(async () => { (host.querySelector('#q-1-Yes') as HTMLButtonElement).click(); });
    await flush();                                                  // no matchMedia in jsdom: reduced motion, so it advances at once
    expect(host.querySelector('#q-2')?.textContent).toBe('Healthy?');
    expect(host.textContent).toContain('Question 2 of 2');
    await act(async () => { (host.querySelector('#q-2-No') as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    await act(async () => { (host.querySelector('#q-2-No') as HTMLButtonElement).click(); });
    await flush();
    expect(host.textContent).toContain('Check your answers');
    expect(host.textContent).toContain('Flavors can see every answer');
    const send = (): HTMLButtonElement => Array.from(host.querySelectorAll('button')).find(b => /Send checklist/.test(b.textContent || '')) as HTMLButtonElement;
    expect(send().disabled).toBe(false);
    await act(async () => { send().click(); });
    expect(sent.length).toBe(1);
    expect((sent[0] as { answers: Record<number, string> }).answers).toEqual({ 1: 'Yes', 2: 'No' });
    act(() => root.unmount());
  });

  it('Y and N keys answer, Back returns to the previous question, review lets you change an answer', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CheckInView source={source([])} facility={{ facilityId: 'f', title: 'F', timeZone: 'America/New_York' }} />); });
    await flush();
    const press = async (key: string): Promise<void> => { await act(async () => { (host.querySelector('.cl-step, [class*="cl-step"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }); await flush(); };
    await press('y');
    expect(host.querySelector('#q-2')).not.toBeNull();
    await act(async () => { (Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement).click(); });
    expect(host.querySelector('#q-1')).not.toBeNull();
    expect((host.querySelector('#q-1-Yes') as HTMLElement).getAttribute('aria-checked')).toBe('true');
    await press('n'); await press('n');
    expect(host.textContent).toContain('Check your answers');
    await act(async () => { (host.querySelector('button[aria-label="Change answer to question 1"]') as HTMLButtonElement).click(); });
    expect(host.querySelector('#q-1')).not.toBeNull();
    act(() => root.unmount());
  });

  const mount = async (history: unknown[]): Promise<{ host: HTMLElement; stop: () => void }> => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CheckInView source={source([], history)} facility={{ facilityId: 'f', title: 'F', timeZone: 'America/New_York' }} />); });
    await flush();
    return { host, stop: () => act(() => root.unmount()) };
  };

  it('entry already sent: no questions, Next opens wellness', async () => {
    const { host, stop } = await mount([{ submissionId: 's1', bookingId: 'r1', kind: 'Entry', createdUtc: new Date().toISOString() }]);
    await act(async () => { (host.querySelector('button[aria-label="Arriving: entry checklist"]') as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('Entry checklist already sent');
    expect(host.querySelector('#q-1')).toBeNull();
    expect(Array.from(host.querySelectorAll('button')).some(b => b.textContent === 'Back')).toBe(false);
    await act(async () => { (Array.from(host.querySelectorAll('button')).find(b => /Next: Team wellness/.test(b.textContent || '')) as HTMLButtonElement).click(); });
    expect(host.textContent).not.toContain('Entry checklist already sent');
    stop();
  });

  it('refused entry shows the questions again with the reason', async () => {
    const { host, stop } = await mount([{ submissionId: 's1', bookingId: 'r1', kind: 'Entry', outcome: 'Not recorded: booking not approved.' }]);
    await act(async () => { (host.querySelector('button[aria-label="Arriving: entry checklist"]') as HTMLButtonElement).click(); });
    expect(host.textContent).not.toContain('already sent');
    expect(host.textContent).toContain('Not recorded: booking not approved.');
    expect(host.querySelector('#q-1')).not.toBeNull();
    stop();
  });

  it('exit already sent shows its card without Next', async () => {
    const { host, stop } = await mount([{ submissionId: 's1', bookingId: 'r1', kind: 'Entry', outcome: 'Recorded.' }, { submissionId: 's2', bookingId: 'r1', kind: 'Exit', outcome: 'Recorded.' }]);
    await act(async () => { (host.querySelector('button[aria-label="Leaving: exit checklist"]') as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('Exit checklist already sent');
    expect(host.textContent).not.toContain('Next: Team wellness');
    stop();
  });
});

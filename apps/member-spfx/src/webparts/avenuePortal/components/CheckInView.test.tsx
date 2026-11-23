/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import CheckInView from './CheckInView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hour = 3600 * 1000;
const booking = { requestId: 'r1', space: 'Kitchen', startUtc: new Date(Date.now() + hour).toISOString(), endUtc: new Date(Date.now() + 3 * hour).toISOString(), status: 'Approved', cancelSent: false, cancelRequested: false, equipmentIds: [] };
const questions = [{ id: 1, kind: 'Entry', text: 'Clean?', order: 1 }, { id: 2, kind: 'Entry', text: 'Healthy?', order: 2 }];
function source(sent: unknown[]): never {
  return {
    listMyRequests: async () => [booking], listChecklistQuestions: async () => questions, listMyCheckIns: async () => [],
    submitCheckIn: async (input: unknown) => { sent.push(input); }
  } as never;
}
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };

describe('CheckInView journey', () => {
  it('sends only when every question is answered, and arrow keys move the answer', async () => {
    const sent: unknown[] = [];
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CheckInView source={source(sent)} facility={{ facilityId: 'f', title: 'F', timeZone: 'America/New_York' }} />); });
    await flush();
    const send = (): HTMLButtonElement => Array.from(host.querySelectorAll('button')).find(b => /Send checklist/.test(b.textContent || '')) as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    await act(async () => { (host.querySelector('#q-1-Yes') as HTMLButtonElement).click(); });
    expect(send().disabled).toBe(true);                        // one of two answered
    const no2 = host.querySelector('#q-2-No') as HTMLButtonElement;
    await act(async () => { no2.click(); });
    expect(send().disabled).toBe(false);
    await act(async () => { (host.querySelector('#q-2-No') as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect((host.querySelector('#q-2-Yes') as HTMLElement).getAttribute('aria-checked')).toBe('true');
    await act(async () => { send().click(); });
    expect(sent.length).toBe(1);
    expect((sent[0] as { answers: Record<number, string> }).answers).toEqual({ 1: 'Yes', 2: 'Yes' });
    act(() => root.unmount());
  });
});

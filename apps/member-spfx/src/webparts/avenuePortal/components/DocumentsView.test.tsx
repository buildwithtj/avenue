/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import DocumentsView from './DocumentsView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); }); };
const day = (n: number): string => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rec = (id: number, docType: string, expiry: number, verified: boolean): Record<string, unknown> => ({ submissionId: `record-${id}`, docType, issueDate: day(-300), expiryDate: day(expiry), outcome: 'Received. Flavors will verify it.', fromRecord: true, verified, recordStatus: 'Current' });
const source = {
  facilityId: 'f', listMyFlags: async () => [], getMyMembership: async () => ({ status: 'Active' }),
  listRequiredDocTypes: async () => ['County food permit', 'MD good standing', 'Liability insurance', 'Workers comp or waiver', 'Food handler card'],
  listMyDocuments: async () => [rec(1, 'County food permit', 200, true), rec(2, 'MD good standing', 10, true), rec(3, 'Liability insurance', 120, false), rec(4, 'Workers comp or waiver', -5, true)]
} as never;

describe('DocumentsView compliance states', () => {
  it('shows every state with an icon label, the completeness ring, and an expandable detail row', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<DocumentsView source={source} timeZone="America/New_York" userEmail="m@x" />); });
    await flush();
    const text = host.textContent || '';
    ['Current', 'Expiring', 'Waiting for verification', 'Expired', 'Missing'].forEach(l => expect(text).toContain(l));
    expect(host.querySelector('[role="img"][aria-label$="required documents current"]')).not.toBeNull();
    const head = host.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(head.getAttribute('aria-expanded')).toBe('false');
    await act(async () => { head.click(); });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    act(() => root.unmount());
  });
});

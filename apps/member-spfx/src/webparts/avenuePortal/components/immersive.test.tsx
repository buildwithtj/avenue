/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import AvenuePortal from './AvenuePortal';
import { IMMERSIVE_CLASS, IMMERSIVE_STYLE_ID, acquireImmersive, forceReleaseImmersive, releaseImmersive } from '../immersive';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const on = (): boolean => document.body.classList.contains(IMMERSIVE_CLASS);
const styleTag = (): HTMLElement | undefined => document.getElementById(IMMERSIVE_STYLE_ID) || undefined;

afterEach(() => forceReleaseImmersive());

describe('immersive helpers', () => {
  it('adds the body class and one scoped style, and removes both on release', () => {
    acquireImmersive();
    expect(on()).toBe(true);
    expect(styleTag()?.textContent).toContain(`body.${IMMERSIVE_CLASS} #SuiteNavWrapper`);
    expect(styleTag()?.textContent).toContain('[data-automationid="SiteNavigation"]');
    releaseImmersive();
    expect(on()).toBe(false);
    expect(styleTag()).toBeUndefined();
  });

  it('is reference counted, and force release always restores the page', () => {
    acquireImmersive(); acquireImmersive();
    expect(document.querySelectorAll(`#${IMMERSIVE_STYLE_ID}`).length).toBe(1);
    releaseImmersive();
    expect(on()).toBe(true);
    forceReleaseImmersive();
    expect(on()).toBe(false);
    expect(styleTag()).toBeUndefined();
  });
});

describe('portal immersive mode', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = async (immersive: boolean): Promise<void> => {
    await act(async () => { root.render(<AvenuePortal source={undefined} isDemo={false} userDisplayName="Ana Cook" userEmail="a@b.co" immersive={immersive} />); });
  };
  const toggle = async (): Promise<void> => {
    await act(async () => { (host.querySelector('[aria-haspopup="dialog"]') as HTMLElement).click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    const sw = Array.prototype.slice.call(document.querySelectorAll('[role="switch"]')).filter((b: HTMLElement) => /Full screen/.test(b.textContent || ''))[0] as HTMLElement;
    await act(async () => { sw.click(); });
    await act(async () => { (document.querySelector('[aria-label="Close account panel"]') as HTMLElement).click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
  };

  it('follows the prop, turns off from the user menu for this page view, and cleans up on unmount', async () => {
    await render(false);
    expect(on()).toBe(false);
    await render(true);
    expect(on()).toBe(true);
    await toggle();
    expect(on()).toBe(false);
    act(() => root.unmount());
    root = createRoot(host);
    await render(true);                       // a fresh mount is full screen again
    expect(on()).toBe(true);
    act(() => root.unmount());                // web part dispose = unmount
    expect(on()).toBe(false);
    expect(styleTag()).toBeUndefined();
    root = createRoot(host);
  });
});

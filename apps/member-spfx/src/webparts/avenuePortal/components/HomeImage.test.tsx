/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { BookingProgress, HomeHero, HomeImageCard, QuickShortcuts } from './RefUi';
import { homeImage } from '../assets';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('Home image card', () => {
  it('shows the one configured picture, lazy, with meaningful alt text and a caption + action', () => {
    let booked = 0;
    act(() => { root.render(<HomeImageCard facility="Flavors" onBook={() => { booked += 1; }} />); });
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(homeImage);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe('The dining room at Flavors');
    expect(img.getAttribute('width')).toBe('960');
    expect(host.textContent).toContain('Your kitchen at Flavors');
    act(() => { (host.querySelector('button') as HTMLButtonElement).click(); });
    expect(booked).toBe(1);
  });
  it('falls back to a neutral tile when the picture fails, keeping the caption', () => {
    act(() => { root.render(<HomeImageCard facility="Flavors" />); });
    act(() => { (host.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error')); });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('section')!.getAttribute('data-failed')).toBe('1');
    expect(host.textContent).toContain('Your kitchen at Flavors');
  });
});

describe('Home hero (v11)', () => {
  it('puts the greeting, pill and primary action over the one configured photo, eager, with alt text and no layout-shift size', () => {
    let booked = 0;
    act(() => { root.render(<HomeHero facility="Flavors" eyebrow="TUESDAY" title="Good morning, Tech" lede="Hello" pill="Open 24 hours" onBook={() => { booked += 1; }} />); });
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(homeImage);
    expect(img.getAttribute('loading')).toBeNull();
    expect(img.getAttribute('alt')).toBe('The dining room at Flavors');
    expect(img.getAttribute('width')).toBe('1280');
    expect(host.querySelector('h1')!.textContent).toBe('Good morning, Tech.');
    expect(host.textContent).toContain('Open 24 hours');
    act(() => { (host.querySelector('[aria-label="Book kitchen time"]') as HTMLButtonElement).click(); });
    expect(booked).toBe(1);
  });
  it('falls back to a plain gradient when the photo fails and keeps the text', () => {
    act(() => { root.render(<HomeHero facility="Flavors" eyebrow="X" title="Hi" />); });
    act(() => { (host.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error')); });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('section')!.getAttribute('data-failed')).toBe('1');
    expect(host.querySelector('h1')!.textContent).toBe('Hi.');
  });
  it('shortcuts are buttons with labels and a badge; none renders nothing', () => {
    let hit = '';
    act(() => { root.render(<QuickShortcuts items={[{ key: 'd', label: 'Documents', icon: 'file-text', onClick: () => { hit = 'd'; }, badge: 2 }]} />); });
    expect(host.textContent).toContain('Documents');
    expect(host.querySelector('b')!.getAttribute('aria-label')).toBe('2 new');
    act(() => { (host.querySelector('button') as HTMLButtonElement).click(); });
    expect(hit).toBe('d');
    act(() => { root.render(<QuickShortcuts items={[]} />); });
    expect(host.querySelector('nav')).toBeNull();
  });
  it('booking progress marks the current step and shows one stopped step for a cancelled booking', () => {
    act(() => { root.render(<BookingProgress status="Approved" />); });
    expect(host.querySelector('[aria-current="step"]')!.textContent).toBe('Approved');
    act(() => { root.render(<BookingProgress status="Approved" live />); });
    expect(host.querySelector('[aria-current="step"]')!.textContent).toBe('In use');
    act(() => { root.render(<BookingProgress status="Approved" past />); });
    expect(host.querySelector('[aria-current="step"]')!.textContent).toBe('Done');
    act(() => { root.render(<BookingProgress status="Cancelled" />); });
    expect(host.querySelectorAll('li').length).toBe(1);
    expect(host.textContent).toBe('Cancelled');
  });
});

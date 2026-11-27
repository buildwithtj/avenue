// Feedback a member can feel and hear: haptic taps, a service-bell chime, toasts and desktop alerts.
// Browser-native only (Vibration, Web Audio, Notification). Every channel has a per-browser on/off switch.

export type Haptic = 'tap' | 'tick' | 'success' | 'warn';
export type Tone = 'ok' | 'bad' | 'info';
export interface IFeedbackPrefs { sound: boolean; haptics: boolean; alerts: boolean }

const KEY: string = 'avenue.feedback';
// [PROPOSED] defaults: sound and haptics on for the member's own actions; desktop alerts only after they opt in.
export const DEFAULT_PREFS: IFeedbackPrefs = { sound: true, haptics: true, alerts: false };

export interface IStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
const store = (): IStore | undefined => { try { return window.localStorage; } catch { return undefined; } };

export function readPrefs(st: IStore | undefined = store()): IFeedbackPrefs {
  try {
    const raw: string | null = st ? st.getItem(KEY) : null;
    const p: Partial<IFeedbackPrefs> = raw ? JSON.parse(raw) : {};
    return { sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_PREFS.sound, haptics: typeof p.haptics === 'boolean' ? p.haptics : DEFAULT_PREFS.haptics, alerts: typeof p.alerts === 'boolean' ? p.alerts : DEFAULT_PREFS.alerts };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function writePrefs(p: IFeedbackPrefs, st: IStore | undefined = store()): void {
  try { if (st) { st.setItem(KEY, JSON.stringify(p)); } } catch { /* private mode: keep in memory only */ }
  try { window.dispatchEvent(new CustomEvent('avenue-feedback-prefs')); } catch { /* old browser */ }
}

const PATTERN: Record<Haptic, number | number[]> = { tap: 8, tick: 5, success: [12, 60, 18], warn: [30, 50, 30] };

// iOS Safari has no Vibration API; toggling a native switch checkbox gives a system haptic (iOS 18+).
let iosSwitch: HTMLLabelElement | undefined;
function iosTick(): void {
  if (!iosSwitch) {
    const label: HTMLLabelElement = document.createElement('label');
    const input: HTMLInputElement = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function buzz(kind: Haptic = 'tap'): void {
  if (!readPrefs().haptics) { return; }
  const ua: { hasBeenActive?: boolean } | undefined = (navigator as unknown as { userActivation?: { hasBeenActive?: boolean } }).userActivation;
  if (ua && !ua.hasBeenActive) { return; }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') { navigator.vibrate(PATTERN[kind]); return; }
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) { iosTick(); }
  } catch { /* no haptics on this device */ }
}

let audio: AudioContext | undefined;
/** A soft two-note chime: bell partials, warm low-pass, a faint echo. ok = rising pair, info = single note, bad = gentle falling pair. */
export function chime(kind: Tone = 'ok'): void {
  if (!readPrefs().sound) { return; }
  try {
    const Ctx: typeof AudioContext | undefined = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) { return; }
    audio = audio || new Ctx();
    const ctx: AudioContext = audio;
    if (ctx.state === 'suspended') { ctx.resume().catch(() => undefined); }
    const t0: number = ctx.currentTime + 0.02;
    // [freq Hz, start s, length s]: C6→G6 (ok), E6 (info), A5→E5 (bad)
    const notes: [number, number, number][] = kind === 'bad' ? [[880, 0, 0.7], [659, 0.16, 0.9]] : kind === 'info' ? [[1319, 0, 1.1]] : [[1047, 0, 1.0], [1568, 0.13, 1.5]];
    const master: GainNode = ctx.createGain();
    master.gain.value = 0.9;
    const tone: BiquadFilterNode = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
    const echo: DelayNode = ctx.createDelay(0.5); echo.delayTime.value = 0.21;
    const fb: GainNode = ctx.createGain(); fb.gain.value = 0.28;
    const wet: GainNode = ctx.createGain(); wet.gain.value = 0.35;
    master.connect(tone); tone.connect(ctx.destination);
    tone.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(ctx.destination);
    // partial ratios and levels of a struck bell: fundamental, a soft octave, a faint inharmonic shimmer
    const partials: [number, number, number][] = [[1, 0.16, 1], [2, 0.06, 0.55], [2.76, 0.025, 0.3]];
    notes.forEach(([freq, at, len]) => {
      partials.forEach(([ratio, level, decay]) => {
        const osc: OscillatorNode = ctx.createOscillator();
        const gain: GainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * ratio;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(level, t0 + at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len * decay);
        osc.connect(gain).connect(master);
        osc.start(t0 + at);
        osc.stop(t0 + at + len * decay + 0.05);
      });
    });
    window.setTimeout(() => { try { master.disconnect(); echo.disconnect(); fb.disconnect(); wet.disconnect(); tone.disconnect(); } catch { /* already gone */ } }, 3500);
  } catch { /* audio blocked */ }
}

export interface IToast { id: number; text: string; tone: Tone }
let next: number = 1;
/** Shows a toast (the portal's Toaster listens), with the matching haptic and sound. */
export function toast(text: string, tone: Tone = 'ok', withSound: boolean = true): void {
  buzz(tone === 'bad' ? 'warn' : 'success');
  if (withSound) { chime(tone); }
  try { window.dispatchEvent(new CustomEvent<IToast>('avenue-toast', { detail: { id: next++, text, tone } })); } catch { /* old browser */ }
}

/** A once-only success moment (request sent, checklist sent, document sent): the shell plays a short check + dots burst. Never call it on a repeat click. */
export function celebrate(text: string): void {
  try { window.dispatchEvent(new CustomEvent<{ text: string }>('avenue-celebrate', { detail: { text } })); } catch { /* old browser */ }
}

export function alertsSupported(): boolean { return typeof window !== 'undefined' && 'Notification' in window; }

/** Asks for desktop-alert permission. Call only from a tap. */
export function requestAlerts(): Promise<boolean> {
  if (!alertsSupported()) { return Promise.resolve(false); }
  if (Notification.permission === 'granted') { return Promise.resolve(true); }
  return Promise.resolve(Notification.requestPermission()).then(p => p === 'granted').catch(() => false);
}

/** A desktop alert, only when the member opted in, granted permission, and is looking at another tab or window. */
export function notify(title: string, body: string): void {
  try {
    if (!readPrefs().alerts || !alertsSupported() || Notification.permission !== 'granted' || !document.hidden) { return; }
    const n: Notification = new Notification(title, { body, tag: `avenue-${title}` });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* blocked */ }
}

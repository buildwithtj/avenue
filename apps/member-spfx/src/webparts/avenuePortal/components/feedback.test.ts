import { DEFAULT_PREFS, readPrefs, writePrefs, type IStore } from './feedback';

const mem = (): IStore & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
};

describe('feedback prefs', () => {
  it('uses the defaults when nothing is stored or storage is unreadable', () => {
    expect(readPrefs(mem())).toEqual(DEFAULT_PREFS);
    expect(readPrefs(undefined)).toEqual(DEFAULT_PREFS);
    const bad = mem(); bad.data['avenue.feedback'] = '{not json';
    expect(readPrefs(bad)).toEqual(DEFAULT_PREFS);
  });
  it('round-trips a member choice and ignores wrong types', () => {
    const st = mem();
    writePrefs({ sound: false, haptics: true, alerts: true }, st);
    expect(readPrefs(st)).toEqual({ sound: false, haptics: true, alerts: true });
    st.data['avenue.feedback'] = JSON.stringify({ sound: 'yes', alerts: true });
    expect(readPrefs(st)).toEqual({ sound: DEFAULT_PREFS.sound, haptics: DEFAULT_PREFS.haptics, alerts: true });
  });
});

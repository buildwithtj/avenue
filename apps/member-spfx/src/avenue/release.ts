import { RELEASE_MODULES } from './release.generated';
import type { TabKey } from '../webparts/avenuePortal/components/AvenuePortal';

/** Which release module owns each screen. Home (and the demo-only join screen) are always in. */
const TAB_MODULE: Partial<Record<TabKey, string>> = {
  bookings: 'booking', book: 'booking', calendar: 'calendar', checkin: 'checkin', documents: 'documents', notices: 'notices', billing: 'billing', membership: 'billing',
  support: 'support', events: 'events', storage: 'storage', team: 'team'
};

/** Modules that exist in the code but are not in a release until listed in release/release.json. Demo and preview show them. */
const NEW_MODULES: string[] = ['support', 'events', 'storage', 'team'];

/** Pure: is this screen in a release that lists `modules`? No list (no release file) means everything. */
export function tabInRelease(tab: TabKey, modules: string[] | undefined, demo: boolean = false): boolean {
  const m: string | undefined = TAB_MODULE[tab];
  return !m || !modules || modules.indexOf(m) >= 0 || (demo && NEW_MODULES.indexOf(m) >= 0);
}

export const tabOn = (tab: TabKey, demo: boolean = false): boolean => tabInRelease(tab, RELEASE_MODULES, demo);

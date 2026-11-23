// [PROPOSED] Immersive (full screen) mode: hides the SharePoint chrome around the portal on pages that host this web part.
// It only toggles a class on document.body and a <style> that is scoped to that class, so removing the class (or the style)
// restores the page exactly. Reference-counted so two portal web parts on one page do not undo each other.

export const IMMERSIVE_CLASS: string = 'avenue-immersive';
export const IMMERSIVE_STYLE_ID: string = 'avenue-immersive-style';

// Selectors that exist on modern SharePoint pages (verify live; SharePoint renames these now and then):
//   #SuiteNavWrapper, #O365_NavHeader, #SuiteNavPlaceholder   Microsoft 365 suite bar and its empty 48 px placeholder
//   [data-automationid="SiteHeader"], #spSiteHeader   site header: logo, title, site navigation
//   [data-automationid="SiteNavigation"], .spLeftNav, #spLeftNav   left navigation on team sites
//   [data-automationid="pageHeader"], [data-automation-id="pageHeader"]   page title banner
//   #spCommandBar, [data-automationid="CommandBar"]   "New / Edit / Share" command bar (read mode only; editors never see immersive)
//   #sp-appBar                             Microsoft 365 app bar (left rail on desktop, bottom bar on narrow screens)
//   [data-automationid="AppChrome"]        page frame: 12 px margin and rounded top corners (checked live 18 Nov 2026)
//   .CanvasZone, .CanvasSection, .ControlZone   page canvas: side padding and max width removed so the web part is full-bleed
const CSS: string = `
body.${IMMERSIVE_CLASS} #SuiteNavWrapper,
body.${IMMERSIVE_CLASS} #SuiteNavPlaceholder,
body.${IMMERSIVE_CLASS} #O365_NavHeader,
body.${IMMERSIVE_CLASS} [data-automationid="SiteHeader"],
body.${IMMERSIVE_CLASS} #spSiteHeader,
body.${IMMERSIVE_CLASS} [data-automationid="SiteNavigation"],
body.${IMMERSIVE_CLASS} .spLeftNav,
body.${IMMERSIVE_CLASS} #spLeftNav,
body.${IMMERSIVE_CLASS} [data-automationid="pageHeader"],
body.${IMMERSIVE_CLASS} [data-automation-id="pageHeader"],
body.${IMMERSIVE_CLASS} #spCommandBar,
body.${IMMERSIVE_CLASS} [data-automationid="CommandBar"],
body.${IMMERSIVE_CLASS} #sp-appBar { display: none !important; }
body.${IMMERSIVE_CLASS} [data-automationid="AppChrome"] { margin: 0 !important; border-radius: 0 !important; }
body.${IMMERSIVE_CLASS} .CanvasZone,
body.${IMMERSIVE_CLASS} .CanvasZone .CanvasSection,
body.${IMMERSIVE_CLASS} .CanvasZone .ControlZone { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; }
`;

let holders: number = 0;

/** Turn immersive mode on. Call `releaseImmersive` once for each call. */
export function acquireImmersive(): void {
  holders += 1;
  if (holders > 1) { return; }
  if (!document.getElementById(IMMERSIVE_STYLE_ID)) {
    const style: HTMLStyleElement = document.createElement('style');
    style.id = IMMERSIVE_STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  document.body.classList.add(IMMERSIVE_CLASS);
}

export function releaseImmersive(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) { return; }
  document.body.classList.remove(IMMERSIVE_CLASS);
  const style: HTMLElement | null = document.getElementById(IMMERSIVE_STYLE_ID);
  if (style) { style.remove(); }
}

/** Unconditional cleanup for web part dispose, whatever the count says. */
export function forceReleaseImmersive(): void {
  holders = 0;
  releaseImmersive();
}

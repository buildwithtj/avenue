// Phone overflow scan (v2, full-bleed aware). The portal now stretches itself to the visible width, so narrowing a container no longer works.
// Instead run the portal in a same-origin iframe of the width under test (SharePoint page + the local debug URL from CLAUDE.md), then paste this on the TOP page:
//   const f = document.createElement('iframe'); f.src = location.href; f.style.cssText = 'position:fixed;top:48px;left:0;width:390px;height:640px;z-index:99999;border:0'; document.body.appendChild(f); window.__f = f;
//   await __run(390, ['Home', 'Bookings', 'Book', 'Schedule', 'Check in', 'Membership', 'Billing'])   // then the other half: Documents ... Policies and help
// Returns only the pages with offenders (an element whose box leaves the frame, ignoring position:fixed and real horizontal scrollers).
// Known false positives: .hero-img (scaled inside an overflow:hidden hero) and the Documents wizard card while its CSS scroll-timeline reveal is off screen.
window.__sleep = ms => new Promise(r => setTimeout(r, ms));
window.__scan = () => {
  const f = window.__f, d = f.contentDocument, w = f.contentWindow, vw = d.documentElement.clientWidth, root = d.querySelector('[data-size]'), off = [];
  const fixed = e => { let p = e; while (p && p !== d.body) { if (w.getComputedStyle(p).position === 'fixed') return true; p = p.parentElement; } return false; };
  const scroller = e => { let p = e.parentElement; while (p && p !== d.body) { const o = w.getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowX) && p.scrollWidth > p.clientWidth + 1 && p !== d.scrollingElement) return true; p = p.parentElement; } return false; };
  const sel = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0].replace(/_[a-z0-9]{4,}$/i, '') : '');
  for (const e of root.querySelectorAll('*')) {
    const cs = w.getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || fixed(e)) continue;
    const b = e.getBoundingClientRect(); if (!b.width && !b.height) continue;
    if ((b.right > vw + 1 || b.left < -1) && !scroller(e)) off.push(sel(e) + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
  }
  return { vw, n: off.length, off: [...new Set(off)].slice(0, 5) };
};
window.__go = async label => {
  const d = window.__f.contentDocument, btns = () => [...d.querySelectorAll('button')], bar = 'nav[aria-label="Avenue sections (phone)"]';
  let b = btns().find(x => x.closest(bar) && x.textContent.trim() === label);
  if (!b) { btns().find(x => x.closest(bar) && x.textContent.trim() === 'More').click(); await __sleep(900); b = btns().find(x => /moreTile/.test(x.className || '') && x.textContent.indexOf(label) === 0); }
  if (!b) return false; b.click(); await __sleep(1300); return true;
};
window.__run = async (w, list) => {
  window.__f.style.width = w + 'px'; await __sleep(1200); const res = {};
  for (const p of list) { await __sleep(500); const ok = await __go(p); await __sleep(p === 'Documents' || p === 'Book' ? 1800 : 600); const off = __scan().off.filter(x => !/hero-img/.test(x)); if (off.length || !ok) res[p] = (ok ? '' : 'NOCLICK ') + off.join(' ; '); }
  return { w: window.__f.contentDocument.documentElement.clientWidth, res };
};

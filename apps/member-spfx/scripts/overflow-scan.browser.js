// Real-data phone overflow scan. Run the local debug preview (npm start; see CLAUDE.md), then paste this in the console of the signed-in portal page.
//   await __w(360)   // returns, per page, the number of elements wider than the portal (0 = fine) and the offenders
// It narrows the portal's own container (the portal measures its container, so data-size becomes 'phone'), clicks every footer/nav page, waits for
// entry animations, skips position:fixed (tab bar, toasts) and real horizontal scrollers. Tested: it reports a deliberate 500px child.
window.__sleep = ms => new Promise(r => setTimeout(r, ms));
window.__root = () => document.querySelector('[data-size]');
window.__setW = async w => { const r = __root(); r.parentElement.style.cssText += `;width:${w}px!important;max-width:${w}px!important;margin:0 auto!important;overflow:visible`; await __sleep(900); return r.getAttribute('data-size') + ':' + Math.round(r.getBoundingClientRect().width); };
window.__clickNav = async label => { const all = [...__root().querySelectorAll('button,a')].filter(e => e.getAttribute('role') !== 'tab'); const b = all.find(e => e.textContent.trim() === label) || all.find(e => e.textContent.trim().startsWith(label)); if (b) { b.click(); await __sleep(1100); return true; } return false; };
window.__scan = () => {
  const root = __root(); const R = root.getBoundingClientRect(); const off = [];
  const sel = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0].replace(/_[a-z0-9]{4,}$/i, '') : '');
  const fixed = e => { let p = e; while (p && p !== root) { if (getComputedStyle(p).position === 'fixed') return true; p = p.parentElement; } return false; };
  const scroller = e => { let p = e.parentElement; while (p && p !== root) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; p = p.parentElement; } return false; };
  for (const e of root.querySelectorAll('*')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || fixed(e)) continue;
    const b = e.getBoundingClientRect(); if (!b.width && !b.height) continue;
    if ((b.right > R.right + 1 || b.left < R.left - 1) && !scroller(e)) off.push(sel(e) + ' ' + Math.round(b.left - R.left) + '..' + Math.round(b.right - R.left) + ' ' + (e.textContent || '').trim().slice(0, 20));
  }
  return { w: Math.round(R.width), sw: root.scrollWidth, cw: root.clientWidth, n: off.length, off: [...new Set(off)].slice(0, 6) };
};
window.PAGES = ['Home', 'My bookings', 'Book', 'Schedule', 'Check in', 'My membership and plans', 'Billing and payments', 'Documents', 'Notices', 'Message Flavors', 'Event request', 'Storage', 'All policies and help'];
window.__w = async w => { const set = await __setW(w); const res = {}; for (const p of PAGES) { const ok = await __clickNav(p); await __sleep(1100); const r = __scan(); res[p] = (ok ? '' : 'NOCLICK ') + r.n + (r.n ? ' ' + JSON.stringify(r.off) : '') + (r.sw > r.cw ? ' SW>CW' : ''); } return JSON.stringify({ set, res }); };

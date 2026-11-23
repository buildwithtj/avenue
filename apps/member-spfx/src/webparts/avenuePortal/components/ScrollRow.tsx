import * as React from 'react';
import s from './Site.module.scss';

/** A horizontal row with no scrollbar: arrow buttons appear at the ends when there is more to scroll in that direction. */
export function ScrollRow(props: { className?: string; label: string; children: React.ReactNode }): React.ReactElement {
  const ref: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const [more, setMore] = React.useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const measure = React.useCallback((): void => {
    const el: HTMLDivElement | null = ref.current;
    if (!el) { return; }
    setMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  React.useEffect(() => {
    measure();
    const el: HTMLDivElement | null = ref.current;
    window.addEventListener('resize', measure);
    const ro: ResizeObserver | undefined = typeof ResizeObserver === 'function' && el ? new ResizeObserver(measure) : undefined;
    if (ro && el) { ro.observe(el); }
    return () => { window.removeEventListener('resize', measure); if (ro) { ro.disconnect(); } };
  }, [measure]);
  const go = (dir: number): void => {
    const el: HTMLDivElement | null = ref.current;
    if (el && typeof el.scrollBy === 'function') { el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' }); }
  };
  return (
    <div className={s.srWrap}>
      {more.left && <button type="button" className={`${s.srArrow} ${s.srLeft}`} aria-label={`Scroll ${props.label} left`} onClick={() => go(-1)}>‹</button>}
      <div ref={ref} className={`${s.srRow} ${props.className || ''}`} onScroll={measure} role="group" aria-label={props.label}>{props.children}</div>
      {more.right && <button type="button" className={`${s.srArrow} ${s.srRight}`} aria-label={`Scroll ${props.label} right`} onClick={() => go(1)}>›</button>}
    </div>
  );
}

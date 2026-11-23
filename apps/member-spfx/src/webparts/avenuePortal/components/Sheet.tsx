import * as React from 'react';
import * as ReactDOM from 'react-dom';
import root from './AvenuePortal.module.scss';
import s from './Site.module.scss';
import { anim, useReducedMotion, useSize } from './motion';

export type SheetSide = 'auto' | 'center';

const FOCUSABLE: string = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Drawer on desktop (right), slide-up sheet on phones, or a centred dialog. Rendered in document.body so no page transform
 * can break position:fixed. Escape and the scrim close it; focus moves in and returns to what opened it; Tab stays inside.
 */
export function Sheet(props: { title: string; onClose: () => void; children: React.ReactNode; side?: SheetSide; footer?: React.ReactNode }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  const size = useSize();
  const panel: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  // Closing plays the exit animation first (200 ms), then tells the parent; with reduced motion it closes at once.
  const [closing, setClosing] = React.useState<boolean>(false);
  const parentClose = props.onClose;
  const onClose = React.useCallback((): void => {
    if (reduced) { parentClose(); return; }
    setClosing(true);
    window.setTimeout(parentClose, 200);
  }, [reduced, parentClose]);
  React.useEffect(() => {
    const opener: Element | null = document.activeElement;
    const el: HTMLDivElement | null = panel.current;
    if (el) { el.focus(); }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !el) { return; }
      const items: HTMLElement[] = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { return; }
      const first: HTMLElement = items[0];
      const last: HTMLElement = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (opener && (opener as HTMLElement).focus) { (opener as HTMLElement).focus(); } };
  }, [onClose]);
  const variant: string = props.side === 'center' ? s.sheetCenter : size === 'phone' ? s.sheetBottom : s.sheetRight;
  return ReactDOM.createPortal(
    <div className={`${root.avenuePortal} ${s.artScope}`} data-motion={reduced ? 'reduce' : 'full'} data-size={size}>
      <div className={`${s.scrim} ${anim(reduced, closing ? s.scrimOut : s.scrimIn)}`} onClick={onClose} data-testid="sheet-scrim" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={props.title} className={`${s.sheet} ${variant} ${anim(reduced, closing ? s.sheetOut : s.sheetIn)}`}>
        <div className={s.sheetHead}>
          <h2 className={s.sheetTitle}>{props.title}</h2>
          <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className={s.sheetBody}>{props.children}</div>
        {props.footer && <div className={s.sheetFoot}>{props.footer}</div>}
      </div>
    </div>,
    document.body
  );
}

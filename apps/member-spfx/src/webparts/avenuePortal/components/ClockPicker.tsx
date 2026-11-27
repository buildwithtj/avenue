import * as React from 'react';
import { RefIcon } from './RefUi';
import { Sheet } from './Sheet';
import s from './Site.module.scss';
import { useReducedMotion } from './motion';

const R: number = 88; // dial radius to the centre of each 44px hour button (box is 240px)
const MID: number = 1440;
const pos = (idx: number): { left: number; top: number } => { const a: number = (idx * Math.PI) / 6; return { left: 120 + R * Math.sin(a) - 22, top: 120 - R * Math.cos(a) - 22 }; };

/** Clock-dial time picker in a Sheet. Values are minutes of the day; 1440 (Midnight) is offered as its own chip. */
export function ClockPicker(props: { title: string; value?: number; allowed: number[]; step: number; format: (m: number) => string; onPick: (m: number) => void; onClose: () => void }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  const dial: number[] = props.allowed.filter(m => m < MID);
  const hasMid: boolean = props.allowed.indexOf(MID) >= 0;
  const inHalf = (h: number): number[] => dial.filter(m => Math.floor(m / 720) === h);
  const seed: number | undefined = props.value !== undefined && props.value < MID ? props.value : dial[0];
  const [half, setHalf] = React.useState<number>(seed !== undefined ? Math.floor(seed / 720) : 0);
  const [hour, setHour] = React.useState<number | undefined>(seed !== undefined && props.value !== undefined && props.value < MID ? Math.floor((seed % 720) / 60) : undefined);
  const mins = (h: number): number[] => inHalf(half).filter(m => Math.floor((m % 720) / 60) === h);
  const pick = (m: number): void => { props.onPick(m); props.onClose(); };
  const tapHour = (h: number): void => { const o: number[] = mins(h); if (o.length === 1) { pick(o[0]); } else { setHour(h); } };
  const label = (h: number): string => `${h === 0 ? 12 : h} ${half === 0 ? 'AM' : 'PM'}`;
  const chips: number[] = hour !== undefined ? mins(hour) : [];
  return (
    <Sheet title={props.title} peek onClose={props.onClose}>
      <div className={s.ckWrap}>
        <p className={s.ckRead} aria-live="polite">{props.value !== undefined ? props.format(props.value) : 'Choose a time'}</p>
        <div className={s.ckHalves} role="group" aria-label="AM or PM">
          {['AM', 'PM'].map((t, h) => (
            <button key={t} type="button" aria-pressed={half === h} disabled={inHalf(h).length === 0} className={half === h ? s.ckHalfOn : ''} onClick={() => { setHalf(h); setHour(undefined); }}>{t}</button>
          ))}
        </div>
        <div className={s.ckDial}>
          {hour !== undefined && <i className={s.ckHand} style={{ transform: `rotate(${hour * 30}deg)`, transition: reduced ? 'none' : undefined }} aria-hidden="true" />}
          <i className={s.ckHub} aria-hidden="true" />
          {Array.from({ length: 12 }, (_, h) => (
            <button key={h} type="button" aria-label={label(h)} aria-pressed={hour === h} disabled={mins(h).length === 0} className={`${s.ckHour} ${hour === h ? s.ckHourOn : ''}`} style={pos(h)} onClick={() => tapHour(h)}>{h === 0 ? 12 : h}</button>
          ))}
        </div>
        <div className={s.ckMins}>
          {chips.map(m => <button key={m} type="button" className={s.ckChip} onClick={() => pick(m)}>{`:${(m % 60 < 10 ? '0' : '') + String(m % 60)}`}</button>)}
          {hasMid && <button type="button" className={s.ckChip} onClick={() => pick(MID)}><RefIcon name="clock-3" size={16} />Midnight</button>}
        </div>
      </div>
    </Sheet>
  );
}

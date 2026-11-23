import * as React from 'react';
import s from './Site.module.scss';
import type { IResource } from '../../../avenue/contracts';
import { type ArtKey, artKeyFor } from '../../../avenue/ui-view';
import { useReducedMotion } from './motion';

// Illustrated equipment set: flat duotone, one stroke weight, one palette (CSS variables --art-1/--art-2/--art-ink/--art-hot).
// Motion (steam, flame flicker, door glint) is CSS transform/opacity only and is dropped under reduced motion.

/** Which artwork a category, id or title gets. */
export function equipmentArt(...hints: (string | undefined)[]): ArtKey { return artKeyFor(...hints); }

const TILE: Record<ArtKey, string> = { stove: s.tileA, flattop: s.tileB, oven: s.tileC, 'oven-upper': s.tileC, 'oven-lower': s.tileC, warmer: s.tileD, pizza: s.tileA, prep: s.tileB, mixer: s.tileD, dining: s.tileC, generic: s.tileB };

function Steam(props: { x: number; y: number; on: boolean }): React.ReactElement {
  return <g className={props.on ? s.aSteam : ''}><path className={s.aLine} d={`M${props.x} ${props.y} q-4 -5 0 -10 t0 -10`} /></g>;
}
function Flame(props: { x: number; y: number; on: boolean }): React.ReactElement {
  return <path className={`${s.aHot} ${props.on ? s.aFlame : ''}`} d={`M${props.x} ${props.y} q-5 -6 -1 -13 q2 4 4 3 q3 3 -3 10z`} />;
}

function Drawing(props: { k: ArtKey; on: boolean }): React.ReactElement {
  const { k, on } = props;
  switch (k) {
    case 'stove':
      return (<>
        <rect className={`${s.aShade} ${s.aLine}`} x="10" y="36" width="100" height="9" rx="3" />
        <rect className={`${s.aBody} ${s.aLine}`} x="15" y="45" width="90" height="36" rx="4" />
        {[26, 48, 70, 92].map(x => <rect key={x} className={s.aLine} x={x - 7} y="31" width="14" height="5" rx="1" />)}
        {[26, 92].map(x => <Flame key={x} x={x} y={31} on={on} />)}
        <path className={`${s.aShade} ${s.aLine}`} d="M53 31 h20 v-10 h-20z" />
        <Steam x={63} y={18} on={on} />
        {[26, 48, 70, 92].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="52" r="3" />)}
        <rect className={`${s.aShade} ${s.aLine}`} x="25" y="58" width="70" height="17" rx="3" />
        <path className={s.aLine} d="M38 62 h44" />
        <path className={`${s.aGlint} ${on ? s.aGlintMove : ''}`} d="M32 59 l8 0 l-6 15 l-8 0z" />
      </>);
    case 'flattop':
      return (<>
        <rect className={`${s.aShade} ${s.aLine}`} x="8" y="34" width="104" height="11" rx="3" />
        <path className={s.aLine} d="M20 34 v-5 M60 34 v-5 M100 34 v-5" />
        <g className={on ? s.aSteam : ''}><path className={s.aLine} d="M36 28 q-3 -4 0 -8 M76 28 q-3 -4 0 -8" /></g>
        <rect className={`${s.aBody} ${s.aLine}`} x="14" y="45" width="92" height="30" rx="3" />
        {[28, 44, 60, 76, 92].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="54" r="3.2" />)}
        <rect className={`${s.aShade} ${s.aLine}`} x="24" y="60" width="72" height="11" rx="2" />
        <path className={s.aLine} d="M20 75 v7 M100 75 v7" />
      </>);
    case 'oven': case 'oven-upper': case 'oven-lower':
      return (<>
        <rect className={`${s.aBody} ${s.aLine}`} x="16" y="8" width="88" height="74" rx="6" />
        {[34, 60, 86].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="17" r="3" />)}
        {[0, 1].map(i => {
          const y: number = 26 + i * 28;
          const hot: boolean = k === 'oven' || (k === 'oven-upper' ? i === 0 : i === 1);
          return (<g key={i}>
            <rect className={`${hot ? s.aHotTint : s.aShade} ${s.aLine}`} x="24" y={y} width="72" height="23" rx="3" />
            <path className={s.aLine} d={`M32 ${y + 8} h56 M32 ${y + 15} h56`} />
            {hot && <path className={`${s.aGlint} ${on ? s.aGlintMove : ''}`} d={`M70 ${y + 1} l8 0 l-6 21 l-8 0z`} />}
          </g>);
        })}
      </>);
    case 'warmer':
      return (<>
        <rect className={`${s.aBody} ${s.aLine}`} x="32" y="5" width="56" height="78" rx="5" />
        <rect className={`${s.aShade} ${s.aLine}`} x="38" y="11" width="44" height="30" rx="3" />
        <rect className={`${s.aShade} ${s.aLine}`} x="38" y="46" width="44" height="30" rx="3" />
        <path className={s.aLine} d="M76 20 v12 M76 55 v12 M45 18 h22 M45 25 h22 M45 53 h22 M45 60 h22" />
        <circle className={`${s.aHot} ${on ? s.aGlow : ''}`} cx="60" cy="8.5" r="2" />
      </>);
    case 'pizza':
      return (<>
        <rect className={`${s.aShade} ${s.aLine}`} x="53" y="6" width="14" height="16" rx="2" />
        <Steam x={60} y={5} on={on} />
        <path className={`${s.aBody} ${s.aLine}`} d="M14 76 a46 46 0 0 1 92 0 z" />
        <path className={`${s.aShade} ${s.aLine}`} d="M42 76 v-16 a18 18 0 0 1 36 0 v16 z" />
        <Flame x={60} y={74} on={on} />
        <Flame x={52} y={74} on={on} />
        <rect className={`${s.aShade} ${s.aLine}`} x="8" y="76" width="104" height="7" rx="2" />
      </>);
    case 'prep':
      return (<>
        <rect className={`${s.aShade} ${s.aLine}`} x="8" y="42" width="104" height="8" rx="2" />
        <path className={s.aLine} d="M16 50 v32 M104 50 v32" />
        <rect className={`${s.aBody} ${s.aLine}`} x="16" y="66" width="88" height="4" />
        <rect className={`${s.aBody} ${s.aLine}`} x="22" y="33" width="30" height="9" rx="2" />
        <path className={s.aLine} d="M58 40 l22 -4" />
        <path className={`${s.aHotTint} ${s.aLine}`} d="M84 42 q0 -12 12 -12 q12 0 12 12 z" />
      </>);
    case 'mixer':
      return (<>
        <rect className={`${s.aShade} ${s.aLine}`} x="26" y="72" width="64" height="10" rx="3" />
        <path className={`${s.aBody} ${s.aLine}`} d="M70 72 v-48 q0 -14 -14 -14 h-26 q-10 0 -10 10 q0 8 10 8 h18 v44 z" />
        <path className={`${s.aShade} ${s.aLine}`} d="M30 70 q0 -16 12 -16 h14 q12 0 12 16 z" />
        <g className={on ? s.aSpin : ''}><path className={s.aLine} d="M43 30 v18 M37 48 q6 6 12 0" /></g>
        <circle className={`${s.aHot}`} cx="76" cy="40" r="3" />
      </>);
    case 'dining':
      return (<>
        <rect className={`${s.aBody} ${s.aLine}`} x="22" y="38" width="76" height="9" rx="3" />
        <path className={s.aLine} d="M32 47 v28 M88 47 v28" />
        {[8, 100].map(x => <path key={x} className={`${s.aShade} ${s.aLine}`} d={`M${x} 74 v-24 h12 v24 M${x} 62 h12`} />)}
        <circle className={s.aHot} cx="60" cy="33" r="4" />
      </>);
    default:
      return <rect className={`${s.aBody} ${s.aLine}`} x="22" y="22" width="76" height="52" rx="6" />;
  }
}

/** Equipment artwork on a tinted tile. A non-empty https PhotoUrl (already sanitised by the read layer) replaces it. */
export function EquipmentArt(props: { unit?: Pick<IResource, 'resourceId' | 'title' | 'category' | 'photoUrl'>; hint?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; label?: string }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  const { unit } = props;
  const [failed, setFailed] = React.useState<boolean>(false);
  const k: ArtKey = unit ? equipmentArt(unit.resourceId, unit.title, unit.category) : equipmentArt(props.hint);
  const size: string = s[`art_${props.size || 'sm'}` as 'art_sm'];
  if (unit && unit.photoUrl && !failed) {
    return <span className={`${s.artTile} ${size}`}><img className={s.artPhoto} src={unit.photoUrl} alt={unit.title} loading="lazy" onError={() => setFailed(true)} /></span>;
  }
  return (
    <span className={`${s.artTile} ${size} ${TILE[k]}`} data-art={k}>
      <svg className={s.art} viewBox="0 0 120 90" role={props.label || unit ? 'img' : undefined} aria-label={props.label || (unit ? unit.title : undefined)} aria-hidden={props.label || unit ? undefined : true} focusable="false">
        <Drawing k={k} on={!reduced} />
      </svg>
    </span>
  );
}

/** The kitchen line: hood, range, flat-top, ovens, shelf and the pass. Hero artwork for Home. */
export function KitchenLine(props: { className?: string }): React.ReactElement {
  const reduced: boolean = useReducedMotion();
  const on: boolean = !reduced;
  return (
    <svg className={`${s.kitchenLine} ${props.className || ''}`} viewBox="0 0 640 300" role="img" aria-label="Illustration of a commercial kitchen line: hood, range, grill, ovens, shelf and pass" focusable="false">
      <path className={`${s.aShade} ${s.aLine}`} d="M70 20 h500 l-40 56 h-420z" />
      {[110, 170, 230, 290, 350, 410, 470].map(x => <path key={x} className={s.aLine} d={`M${x} 34 l-8 30`} />)}
      <rect className={`${s.aBody} ${s.aLine}`} x="40" y="92" width="560" height="8" rx="3" />
      {[[80, 'M0 0 h10 v14 h-10z'], [150, 'M0 0 h12 v14 h-12z'], [230, 'M0 0 h10 v14 h-10z']].map(([x, d]) => <path key={x as number} className={`${s.aHotTint} ${s.aLine}`} d={d as string} transform={`translate(${x} 78)`} />)}
      <path className={s.aLine} d="M360 100 v22 M400 100 v22 M440 100 v22 M480 100 v22" />
      <rect className={`${s.aShade} ${s.aLine}`} x="350" y="124" width="150" height="6" rx="2" />
      {[372, 410, 448, 480].map(x => <rect key={x} className={`${s.aHotTint} ${s.aLine}`} x={x} y="110" width="14" height="14" rx="2" />)}
      <rect className={`${s.aBody} ${s.aLine}`} x="40" y="150" width="210" height="110" rx="6" />
      <rect className={`${s.aShade} ${s.aLine}`} x="30" y="142" width="230" height="12" rx="4" />
      {[70, 120, 170, 220].map(x => <rect key={x} className={s.aLine} x={x - 10} y="132" width="20" height="10" rx="2" />)}
      {[70, 220].map(x => <Flame key={x} x={x} y={132} on={on} />)}
      <Steam x={120} y={126} on={on} />
      {[70, 120, 170, 220].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="168" r="6" />)}
      <rect className={`${s.aShade} ${s.aLine}`} x="62" y="184" width="136" height="64" rx="4" />
      <path className={`${s.aGlint} ${on ? s.aGlintMove : ''}`} d="M80 186 l16 0 l-14 60 l-16 0z" />
      <rect className={`${s.aBody} ${s.aLine}`} x="270" y="170" width="150" height="90" rx="5" />
      <rect className={`${s.aShade} ${s.aLine}`} x="262" y="160" width="166" height="14" rx="4" />
      {[300, 335, 370, 400].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="190" r="5" />)}
      <rect className={`${s.aShade} ${s.aLine}`} x="286" y="204" width="118" height="44" rx="4" />
      <g className={on ? s.aSteam : ''}><path className={s.aLine} d="M300 152 q-4 -6 0 -12 M350 152 q-4 -6 0 -12 M400 152 q-4 -6 0 -12" /></g>
      <rect className={`${s.aBody} ${s.aLine}`} x="440" y="140" width="130" height="120" rx="6" />
      {[0, 1].map(i => <g key={i}><rect className={`${i === 0 ? s.aHotTint : s.aShade} ${s.aLine}`} x="452" y={172 + i * 42} width="106" height="34" rx="4" /><path className={s.aLine} d={`M462 ${184 + i * 42} h86`} /></g>)}
      {[480, 512, 544].map(x => <circle key={x} className={`${s.aShade} ${s.aLine}`} cx={x} cy="156" r="5" />)}
      <path className={s.aLine} d="M20 262 h600" />
    </svg>
  );
}

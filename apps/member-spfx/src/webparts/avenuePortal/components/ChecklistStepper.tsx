import * as React from 'react';
import type { Answer } from '../../../avenue/checkin';
import type { IChecklistQuestion } from '../../../avenue/contracts';
import { motionAllowed } from './gsapMotion';
import rx from './Ref.module.scss';

export interface IChecklistStepperProps {
  questions: IChecklistQuestion[];
  answers: Record<number, Answer>;
  onAnswer: (id: number, a: Answer) => void;
  onSend: () => void;
  sending: boolean;
  /** A booking is chosen: the review step may send. */
  canSend: boolean;
}

const LEAVE_MS: number = 240;
const TICK_MS: number = 330;

/**
 * One question at a time. Answering draws a tick, the card slides out and the next one slides in; a final review step lists
 * every answer (tap one to change it) before sending. Reduced motion: no waiting, no movement. Answers live in the parent.
 */
export default function ChecklistStepper(props: IChecklistStepperProps): React.ReactElement {
  const { questions, answers, onAnswer } = props;
  const total: number = questions.length;
  const firstOpen: number = questions.findIndex(q => !answers[q.id]);
  const [index, setIndex] = React.useState<number>(firstOpen < 0 ? total : firstOpen);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [phase, setPhase] = React.useState<'in' | 'tick' | 'out'>('in');
  // Keyboard-initiated answers (Y / N) repeat all day: no tick or slide, the next question just appears.
  const [still, setStill] = React.useState<boolean>(false);
  const timers: React.MutableRefObject<number[]> = React.useRef<number[]>([]);
  React.useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const q: IChecklistQuestion | undefined = questions[index];
  const answered: number = questions.filter(x => answers[x.id]).length;
  const review: boolean = index >= total;
  const go = (to: number, d: 1 | -1): void => { setDir(d); setIndex(Math.max(0, Math.min(total, to))); setPhase('in'); };

  const answer = (a: Answer, viaKey: boolean = false): void => {
    if (!q || phase !== 'in') { return; }
    onAnswer(q.id, a);
    setStill(viaKey);
    if (viaKey || !motionAllowed()) { go(index + 1, 1); return; }
    setPhase('tick');
    timers.current.push(window.setTimeout(() => {
      setPhase('out');
      timers.current.push(window.setTimeout(() => go(index + 1, 1), LEAVE_MS));
    }, TICK_MS));
  };

  const key = (e: React.KeyboardEvent): void => {
    if (review) { return; }
    const k: string = e.key.toLowerCase();
    if (k === 'y') { e.preventDefault(); answer('Yes', true); }
    else if (k === 'n') { e.preventDefault(); answer('No', true); }
    else if (e.key === 'Backspace' && index > 0 && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); go(index - 1, -1); }
  };

  return (
    <div className={rx['cl-step']} onKeyDown={key}>
      <div className={rx['cl-top']}>
        <span className={rx['cl-count']}>{review ? 'Review' : `Question ${index + 1} of ${total}`}</span>
        <span className={rx['cl-count']}>{answered} of {total} answered</span>
      </div>
      <div className={rx['cl-bar']} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label="Checklist progress">
        <i style={{ transform: `scaleX(${total ? answered / total : 0})` }} />
      </div>
      <ol className={rx['cl-dots']} aria-label="Steps">
        {questions.map((x, i) => (
          <li key={x.id}>
            <button type="button" className={`${rx['cl-dot']} ${i === index ? rx['is-now'] : ''} ${answers[x.id] ? rx['is-done'] : ''}`} aria-label={`Question ${i + 1}${answers[x.id] ? `: ${answers[x.id]}` : ''}`}
              aria-current={i === index ? 'step' : undefined} onClick={() => go(i, i > index ? 1 : -1)} />
          </li>
        ))}
      </ol>
      <div className={rx['visually-hidden']} role="status" aria-live="polite">{review ? 'Review your answers, then send.' : q ? `Question ${index + 1} of ${total}: ${q.text}` : ''}</div>

      {!review && q && (
        <div key={q.id} className={`${rx['cl-card']} ${still ? '' : dir === 1 ? rx['from-right'] : rx['from-left']} ${phase === 'out' ? rx['is-out'] : ''}`} role="group" aria-labelledby={`q-${q.id}`}>
          <div id={`q-${q.id}`} className={rx['cl-q']}>{q.text}</div>
          <div className={rx['cl-choices']} role="radiogroup" aria-labelledby={`q-${q.id}`}>
            {(['Yes', 'No'] as Answer[]).map(a => {
              const on: boolean = answers[q.id] === a;
              return (
                <button key={a} id={`q-${q.id}-${a}`} type="button" role="radio" aria-checked={on}
                  className={`${rx['cl-choice']} ${a === 'Yes' ? rx['is-yes'] : rx['is-no']} ${on ? rx['is-on'] : ''} ${on && phase === 'tick' ? rx['is-ticking'] : ''}`}
                  onKeyDown={e => {
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) {
                      e.preventDefault();
                      const other: Answer = a === 'Yes' ? 'No' : 'Yes';
                      const el: HTMLElement | null = document.getElementById(`q-${q.id}-${other}`);
                      if (el) { el.focus(); }
                    }
                  }}
                  onClick={() => answer(a)}>
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                    {a === 'Yes' ? <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} /> : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" pathLength={1} />}
                  </svg>
                  <span>{a}</span>
                </button>
              );
            })}
          </div>
          <div className={rx['cl-nav']}>
            <button type="button" className={rx['secondary-button']} disabled={index === 0} onClick={() => go(index - 1, -1)}>Back</button>
            {answers[q.id] && <button type="button" className={rx['secondary-button']} onClick={() => go(index + 1, 1)}>Next</button>}
            <span className={rx['cl-hint']}>Tip: press Y or N</span>
          </div>
        </div>
      )}

      {review && (
        <div key="review" className={`${rx['cl-card']} ${rx['from-right']}`}>
          <div className={rx['cl-q']}>Check your answers</div>
          <ul className={rx['cl-review']}>
            {questions.map((x, i) => (
              <li key={x.id} style={{ ['--i' as string]: i } as React.CSSProperties}>
                <button type="button" onClick={() => go(i, -1)} aria-label={`Change answer to question ${i + 1}`}>
                  <span className={`${rx['cl-pill']} ${answers[x.id] === 'No' ? rx['is-no'] : rx['is-yes']}`}>{answers[x.id] || '–'}</span>
                  <span>{x.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {questions.some(x => answers[x.id] === 'No') && <p className={rx['cl-hint']}>Flavors can see every answer, including the ones marked No.</p>}
          <div className={rx['cl-nav']}>
            <button type="button" className={rx['secondary-button']} onClick={() => go(total - 1, -1)} disabled={total === 0}>Back</button>
            <button type="button" className={rx['primary-button']} onClick={props.onSend} disabled={props.sending || !props.canSend || answered < total}>{props.sending ? 'Sending…' : 'Send checklist'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

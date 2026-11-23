import * as React from 'react';
import s from './Site.module.scss';
import type { Answer } from '../../../avenue/checkin';
import type { IChecklistQuestion } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { useReducedMotion } from './motion';

export interface IWellnessCheckProps {
  source: AvenueReadSource;
  facilityId: string;
  timeZone: string;
  bookingId: string;
  /** Active Wellness questions, in order. */
  questions: IChecklistQuestion[];
  /** Names from the member's team roster; the lead can still add or remove people for today. */
  roster?: string[];
  onDone: () => void;
}

type Phase = 'names' | 'cards' | 'sending' | 'done';

// Team wellness (CHK-02, Q-M6 default): the lead adds each team member and answers that person's wellness questions on
// their own phone; each person is sent as a separate Wellness submission. Answers are private to the member and Flavors.
export default function WellnessCheck(props: IWellnessCheckProps): React.ReactElement {
  const { source, questions } = props;
  const reduced: boolean = useReducedMotion();
  const [phase, setPhase] = React.useState<Phase>('names');
  const [names, setNames] = React.useState<string[]>(props.roster || []);
  const [draft, setDraft] = React.useState<string>('');
  const [answers, setAnswers] = React.useState<Record<number, Answer>[]>([]);
  const [pos, setPos] = React.useState<number>(0);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [sent, setSent] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | undefined>();
  const [at, setAt] = React.useState<Date | undefined>();
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { if (phase === 'cards' && heading.current) { heading.current.focus(); } }, [pos, phase]);

  if (questions.length === 0) {
    return <p className={s.wlQuiet}>Flavors has not added wellness questions yet. Nothing to do here for now.</p>;
  }

  const total: number = names.length * questions.length;
  const person: number = Math.floor(pos / questions.length);
  const q: IChecklistQuestion | undefined = questions[pos % questions.length];

  const add = (): void => {
    const n: string = draft.trim();
    if (n.length < 2 || n.length > 80) { setError('Enter a name of 2 to 80 characters.'); return; }
    if (names.some(x => x.toLowerCase() === n.toLowerCase())) { setError('That name is already on the list.'); return; }
    setNames(names.concat(n)); setDraft(''); setError(undefined);
  };

  const sendAll = (all: Record<number, Answer>[]): void => {
    setPhase('sending'); setError(undefined);
    const todo: number[] = names.map((_n, k) => k).filter(k => sent.indexOf(names[k]) < 0);
    const done: string[] = sent.slice();
    const next = (i: number): void => {
      if (i >= todo.length) { setSent(done); setAt(new Date()); setPhase('done'); return; }
      const k: number = todo[i];
      source.submitCheckIn({ facilityId: props.facilityId, bookingId: props.bookingId, kind: 'Wellness', answers: all[k], personName: names[k] }, questions, newSubmissionId('well'))
        .then(() => { done.push(names[k]); next(i + 1); })
        .catch((e: Error) => { setSent(done.slice()); setError(`${e.message} ${done.length} of ${names.length} sent; press Send again for the rest.`); setPhase('cards'); });
    };
    next(0);
  };

  const answer = (a: Answer): void => {
    if (!q) { return; }
    const all: Record<number, Answer>[] = names.map((_n, k) => ({ ...(answers[k] || {}) }));
    all[person][q.id] = a;
    setAnswers(all);
    if (pos + 1 < total) { setDir(1); setPos(pos + 1); } else { sendAll(all); }
  };

  if (phase === 'done') {
    return (
      <section className={s.wlDone} aria-live="polite" aria-label="Wellness recorded">
        <svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
        <h3>Wellness sent for {sent.length} {sent.length === 1 ? 'person' : 'people'}</h3>
        <p>Recorded at {new Intl.DateTimeFormat('en-US', { timeZone: props.timeZone, hour: 'numeric', minute: '2-digit' }).format(at || new Date())}: {sent.join(', ')}.</p>
        <button type="button" className={s.cwYes} onClick={props.onDone}>Done</button>
      </section>
    );
  }

  if (phase === 'names') {
    return (
      <section className={s.wl} aria-label="Team wellness">
        <h3>Who is working today?</h3>
        <p className={s.cwHelp}>Add each team member, then answer {questions.length} short question{questions.length === 1 ? '' : 's'} for each person.</p>
        <div className={s.wlAdd}>
          <label className={s.srOnly} htmlFor="wl-name">Team member name</label>
          <input id="wl-name" value={draft} maxLength={80} placeholder="Name" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button type="button" className={s.cwSkip} onClick={add}>Add</button>
        </div>
        {names.length > 0 && (
          <ul className={s.wlNames}>
            {names.map(n => <li key={n}><span>{n}</span><button type="button" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter(x => x !== n))}>✕</button></li>)}
          </ul>
        )}
        {error && <p className={s.cwErr} role="alert">{error}</p>}
        <div className={s.cwActions}><button type="button" className={s.cwYes} disabled={names.length === 0} onClick={() => { setAnswers(names.map(() => ({}))); setPos(0); setPhase('cards'); }}>Start wellness check</button></div>
      </section>
    );
  }

  const lastAnswered: boolean = sent.length > 0 || (!!q && answers[person] && answers[person][q.id] !== undefined && pos === total - 1);
  return (
    <section className={s.wl} aria-label="Team wellness">
      <div className={s.wlDots} aria-hidden="true">{Array.from({ length: total }, (_x, k) => <i key={k} data-state={k < pos ? 'done' : k === pos ? 'on' : 'todo'} />)}</div>
      <p className={s.cwEyebrow}>Person {person + 1} of {names.length}: {names[person]} · question {(pos % questions.length) + 1} of {questions.length}</p>
      <div className={s.cwStage}>
        <div key={pos} className={`${s.wlCard} ${reduced ? s.jnFade : dir === 1 ? s.cwInFwd : s.cwInBack}`}>
          <h3 ref={heading} tabIndex={-1}>{q ? q.text : ''}</h3>
          <div className={s.wlYesNo} role="group" aria-label={`Answer for ${names[person]}`}>
            {(['Yes', 'No'] as Answer[]).map(a => (
              <button key={a} type="button" disabled={phase === 'sending'} aria-pressed={!!q && answers[person] && answers[person][q.id] === a} className={a === 'Yes' ? s.wlYes : s.wlNo} onClick={() => answer(a)}>{a}</button>
            ))}
          </div>
        </div>
      </div>
      {phase === 'sending' && <p className={s.cwHelp} role="status">Sending…</p>}
      {error && <p className={s.cwErr} role="alert">{error}</p>}
      <div className={s.cwNav}>
        <button type="button" className={s.cwSkip} disabled={pos === 0 || phase === 'sending'} onClick={() => { setDir(-1); setPos(pos - 1); }}>Back</button>
        {error && lastAnswered && <button type="button" className={s.cwYes} onClick={() => sendAll(answers)}>Send again</button>}
      </div>
    </section>
  );
}

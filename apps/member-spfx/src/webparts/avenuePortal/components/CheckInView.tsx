import * as React from 'react';
import { DefaultButton, PrimaryButton, Spinner } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import type { Answer } from '../../../avenue/checkin';
import { checkInCountdown, defaultBooking, eligibleBookings, progress, recordState, suggestKind } from '../../../avenue/checklist';
import WellnessCheck from './WellnessCheck';
import { wellnessNames } from '../../../avenue/team';
import s from './Site.module.scss';
import type { CheckInKind, IChecklistQuestion, IFacility, IMyCheckIn, IMyRequest } from '../../../avenue/contracts';
import { dateParts } from '../../../avenue/home';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { Empty, ErrorBar, useLoad } from './ui';

export interface ICheckInViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  /** The team roster module is on: prefill the wellness names from it. */
  rosterOn?: boolean;
}

interface ICheckInData {
  bookings: IMyRequest[];
  questions: IChecklistQuestion[];
  history: IMyCheckIn[];
  /** Active team names for the wellness check; empty when the roster is off or unreadable. */
  roster: string[];
}

// Entry and exit checklists (CHK-01). Answers are private to the member and Flavors. The flow records a checklist only
// for the author's own approved booking, whatever this screen sends. A "No" has no automatic consequence (CHK-05): Flavors sees it.
export default function CheckInView(props: ICheckInViewProps): React.ReactElement {
  const { source, facility } = props;
  const tz: string = facility.timeZone;
  const data = useLoad<ICheckInData>(async () => {
    const [bookings, questions, history, roster] = await Promise.all([
      source.listMyRequests(), source.listChecklistQuestions(), source.listMyCheckIns(),
      props.rosterOn && typeof source.listMyTeam === 'function' ? source.listMyTeam().then(wellnessNames).catch((): string[] => []) : Promise.resolve<string[]>([])
    ]);
    return { bookings, questions, history, roster };
  }, [source]);
  const [bookingId, setBookingId] = React.useState<string>('');
  const [kind, setKind] = React.useState<CheckInKind | undefined>();
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({});
  const [sending, setSending] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [sentId, setSentId] = React.useState<string | undefined>();
  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);

  // Pre-pick the booking and the checklist still to do, once the data arrives. The member can change both.
  React.useEffect(() => {
    if (!data.data || bookingId) { return; }
    const pick: IMyRequest | undefined = defaultBooking(eligibleBookings(data.data.bookings, Date.now()), Date.now());
    if (pick) {
      setBookingId(pick.requestId);
      setKind(suggestKind(pick.requestId, data.data.history));
    }
  }, [data.data]);

  // After sending, look for the flow's answer (about two minutes at most).
  React.useEffect(() => {
    if (!sentId) { return; }
    let live: boolean = true;
    let tries: number = 0;
    const timer: { id?: number } = {};
    const poll = (): void => {
      tries += 1;
      data.reload();
      if (live && tries < 12) { timer.id = window.setTimeout(poll, 8000); }
    };
    timer.id = window.setTimeout(poll, 4000);
    return () => { live = false; window.clearTimeout(timer.id); };
  }, [sentId]);

  if (data.error) {
    return (
      <div className={styles.errorPanel} role="alert">
        <strong>We could not load check-in.</strong><span>{data.error}</span>
        <DefaultButton text="Try again" onClick={data.reload} />
      </div>
    );
  }
  if (!data.data) {
    return <Spinner label="Loading check-in" />;
  }

  const now: number = Date.now();
  const eligible: IMyRequest[] = eligibleBookings(data.data.bookings, now);
  const byId: Map<string, IMyRequest> = new Map(data.data.bookings.map(b => [b.requestId, b]));
  const activeKind: CheckInKind = kind || 'Entry';
  const questions: IChecklistQuestion[] = data.data.questions.filter(q => q.kind === activeKind).sort((a, b) => a.order - b.order);
  const prog = progress(questions, answers);
  const chosen: IMyRequest | undefined = byId.get(bookingId);
  const closesIn: number | undefined = chosen && activeKind !== 'Exit' ? checkInCountdown(chosen.startUtc, now, facility.earlyEntryMinutes ?? 30) : undefined;
  const sentItem: IMyCheckIn | undefined = sentId ? data.data.history.filter(h => h.submissionId === sentId)[0] : undefined;

  const chooseBooking = (id: string): void => {
    setBookingId(id);
    setKind(suggestKind(id, data.data!.history));
    setAnswers({});
    setError(undefined);
  };

  const send = (): void => {
    if (inFlight.current || sending || !bookingId || !prog.complete) { return; }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    const id: string = newSubmissionId('chk');
    source.submitCheckIn({ facilityId: facility.facilityId, bookingId, kind: activeKind, answers }, data.data!.questions, id)
      .then(() => { setSentId(id); setAnswers({}); })
      .catch((err: Error) => setError(`${err.message} Your answers are kept; you can send it again.`))
      .then(() => { inFlight.current = false; setSending(false); }, () => { inFlight.current = false; setSending(false); });
  };

  if (sentId) {
    const r = recordState(sentItem);
    return (
      <section className={`${styles.sentCard} ${r.state === 'recorded' ? styles.sentOk : r.state === 'not-recorded' ? styles.sentBad : ''}`} aria-live="polite" aria-label="Checklist result">
        <div className={styles.eyebrow}>{activeKind} checklist</div>
        <h2 className={styles.sentTitle}>{r.state === 'recorded' ? 'Checklist recorded.' : r.state === 'not-recorded' ? 'Checklist not recorded.' : 'Checklist sent.'}</h2>
        <p>{r.text}</p>
        <div className={styles.nextActions}>
          {activeKind === 'Entry' && data.data.questions.some(q => q.kind === 'Wellness') && (
            <PrimaryButton className={styles.bigButton} text="Next: team wellness" onClick={() => { setSentId(undefined); setKind('Wellness'); }} />
          )}
          <DefaultButton className={styles.bigButton} text="Done" onClick={() => { setSentId(undefined); }} />
        </div>
      </section>
    );
  }

  return (
    <div className={styles.stack}>
      {eligible.length === 0 ? (
        <Empty>You have no approved booking today or in the next 24 hours, so there is no checklist to complete.</Empty>
      ) : (
        <section className={styles.bookForm} aria-label="Checklist">
          <fieldset className={styles.fieldset}>
            <legend className={styles.sectionLabel}>Which booking?</legend>
            <div className={styles.spaceCards}>
              {eligible.map(b => {
                const p = dateParts(b.startUtc, b.endUtc, tz);
                return (
                  <label key={b.requestId} className={`${styles.spaceCard} ${bookingId === b.requestId ? styles.spaceOn : ''}`}>
                    <input type="radio" name="booking" checked={bookingId === b.requestId} onChange={() => chooseBooking(b.requestId)} />
                    <strong>{p.weekday} {p.month} {p.day}, {p.time}</strong>
                    <span>{b.equipmentIds && b.equipmentIds.length > 0 ? `${b.space} · ${b.equipmentIds.join(', ')}` : b.space}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className={styles.segment} role="group" aria-label="Checklist type" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['Entry', 'Exit', 'Wellness'] as CheckInKind[]).map(k => (
              <button key={k} type="button" className={`${styles.segmentBtn} ${activeKind === k ? styles.segmentOn : ''}`} aria-pressed={activeKind === k}
                onClick={() => { setKind(k); setAnswers({}); setError(undefined); }}>
                {k === 'Entry' ? 'Arriving: entry checklist' : k === 'Exit' ? 'Leaving: exit checklist' : 'Team wellness'}
              </button>
            ))}
          </div>
          {closesIn !== undefined && <span className={s.wlChip} role="status">Check-in closes in {closesIn} min</span>}

          {activeKind === 'Wellness' ? (
            bookingId
              ? <WellnessCheck key={bookingId} roster={data.data.roster} source={source} facilityId={facility.facilityId} timeZone={tz} bookingId={bookingId} questions={questions} onDone={() => { setKind('Entry'); data.reload(); }} />
              : <Empty>Choose a booking first.</Empty>
          ) : questions.length === 0 ? (
            <Empty>Flavors has not set up the {activeKind.toLowerCase()} checklist yet.</Empty>
          ) : (
            <>
              <div className={styles.checkProgress} aria-live="polite">{prog.answered} of {prog.total} answered</div>
              <ul className={styles.questionList}>
                {questions.map(q => (
                  <li key={q.id} className={styles.questionCard}>
                    <div id={`q-${q.id}`} className={styles.questionText}>{q.text}</div>
                    <div className={styles.yesNo} role="radiogroup" aria-labelledby={`q-${q.id}`}>
                      {(['Yes', 'No'] as Answer[]).map(a => (
                        <button key={a} id={`q-${q.id}-${a}`} type="button" role="radio" aria-checked={answers[q.id] === a}
                          tabIndex={answers[q.id] === a || (!answers[q.id] && a === 'Yes') ? 0 : -1}
                          className={`${styles.yesNoBtn} ${answers[q.id] === a ? (a === 'Yes' ? styles.yesOn : styles.noOn) : ''}`}
                          onKeyDown={e => {
                            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) {
                              e.preventDefault();
                              const other: Answer = a === 'Yes' ? 'No' : 'Yes';
                              setAnswers({ ...answers, [q.id]: other });
                              window.setTimeout(() => { const el: HTMLElement | null = document.getElementById(`q-${q.id}-${other}`); if (el) { el.focus(); } }, 0);
                            }
                          }}
                          onClick={() => setAnswers({ ...answers, [q.id]: a })}>{a}</button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {prog.noCount > 0 && <p className={styles.hint}>Flavors can see every answer, including the ones marked No.</p>}
            </>
          )}

          {activeKind !== 'Wellness' && (
            <>
              <ErrorBar error={error} onDismiss={() => setError(undefined)} />
              <div className={styles.stepActions}>
                <PrimaryButton className={styles.bigButton} text={sending ? 'Sending…' : 'Send checklist'} onClick={send} disabled={sending || !bookingId || !prog.complete} />
              </div>
            </>
          )}
        </section>
      )}

      <section aria-label="Sent checklists">
        <h2 className={styles.sectionLabel}>Sent checklists</h2>
        {data.data.history.length === 0 ? <Empty>None yet.</Empty> : (
          <ul className={styles.bookGroup}>
            {data.data.history.slice().reverse().slice(0, 20).map(h => {
              const b: IMyRequest | undefined = byId.get(h.bookingId);
              const p = b ? dateParts(b.startUtc, b.endUtc, tz) : undefined;
              const r = recordState(h);
              return (
                <li key={h.submissionId} className={styles.bookCard}>
                  <div className={styles.bookBody}>
                    <span className={styles.rowTitle}>{h.kind === 'Wellness' ? `Wellness: ${h.personName || 'team member'}` : `${h.kind} checklist`}</span>
                    <span className={styles.rowMeta}>{p ? `${p.weekday} ${p.month} ${p.day}, ${p.time}` : h.bookingId}</span>
                    <span><span className={`${styles.statusPill} ${r.state === 'recorded' ? styles.statusOk : r.state === 'not-recorded' ? styles.statusBad : styles.statusWaiting}`}>{r.state === 'recorded' ? 'Recorded' : r.state === 'not-recorded' ? 'Not recorded' : 'Being recorded'}</span></span>
                    {r.state === 'not-recorded' && <span className={styles.muted}>{r.text}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

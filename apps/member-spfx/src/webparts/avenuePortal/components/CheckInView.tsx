import * as React from 'react';
import { celebrate } from './feedback';
import styles from './AvenuePortal.module.scss';
import type { Answer } from '../../../avenue/checkin';
import { checkInCountdown, defaultBooking, eligibleBookings, progress, recordState, sentChecklistLabel, sentFor, suggestKind } from '../../../avenue/checklist';
import ChecklistStepper from './ChecklistStepper';
import WellnessCheck from './WellnessCheck';
import { wellnessNames } from '../../../avenue/team';
import s from './Site.module.scss';
import type { CheckInKind, IChecklistQuestion, IFacility, IMyCheckIn, IMyRequest, IResource } from '../../../avenue/contracts';
import { equipmentChips } from '../../../avenue/ui-helpers';
import { dateParts } from '../../../avenue/home';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import rx from './Ref.module.scss';
import { ModuleCard, ModuleRow, RefIcon } from './RefUi';
import { Empty, ErrorBar, useLoad } from './ui';

export interface ICheckInViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  /** The team roster module is on: prefill the wellness names from it. */
  rosterOn?: boolean;
  /** Catalogue, so bookings show unit names, never ids. */
  resources?: IResource[];
  /** Opened from a booking's details: pre-pick this booking when it can take a checklist. */
  initialBookingId?: string;
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
  // Optimistic: what this session just sent counts as pending until the list returns it.
  const [justSent, setJustSent] = React.useState<IMyCheckIn[]>([]);
  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);

  // Pre-pick the booking and the checklist still to do, once the data arrives. The member can change both.
  React.useEffect(() => {
    if (!data.data || bookingId) { return; }
    const eligible: IMyRequest[] = eligibleBookings(data.data.bookings, Date.now());
    const asked: IMyRequest | undefined = props.initialBookingId ? eligible.filter(b => b.requestId === props.initialBookingId)[0] : undefined;
    const pick: IMyRequest | undefined = asked || defaultBooking(eligible, Date.now());
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
        <button type="button" className={rx['secondary-button']} onClick={data.reload}>Try again</button>
      </div>
    );
  }
  if (!data.data) {
    return <div className={rx['ref-skeleton']} role="status" aria-label="Loading check-in" />;
  }

  const now: number = Date.now();
  const eligible: IMyRequest[] = eligibleBookings(data.data.bookings, now);
  const byId: Map<string, IMyRequest> = new Map(data.data.bookings.map(b => [b.requestId, b]));
  const activeKind: CheckInKind = kind || 'Entry';
  const questions: IChecklistQuestion[] = data.data.questions.filter(q => q.kind === activeKind).sort((a, b) => a.order - b.order);
  const prog = progress(questions, answers);
  const chosen: IMyRequest | undefined = byId.get(bookingId);
  const closesIn: number | undefined = chosen && activeKind !== 'Exit' ? checkInCountdown(chosen.startUtc, now, facility.earlyEntryMinutes ?? 30) : undefined;
  const history: IMyCheckIn[] = data.data.history.concat(justSent.filter(j => !data.data!.history.some(h => h.submissionId === j.submissionId)));
  const found = activeKind === 'Wellness' ? {} : sentFor(history, bookingId, activeKind);
  const refusedNow: IMyCheckIn | undefined = !found.sent && found.refused && recordState(found.refused).state === 'not-recorded' ? found.refused : undefined;
  const sentWhen = (h: IMyCheckIn): string => {
    const d: Date = new Date(h.createdUtc || Date.now());
    const fmt = (o: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(d);
    const same: boolean = new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(d) === new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return `${same ? 'today' : fmt({ month: 'short', day: 'numeric' })} at ${fmt({ hour: 'numeric', minute: '2-digit' })}`;
  };

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
      .then(() => { setSentId(id); setJustSent(prev => prev.concat({ submissionId: id, bookingId, kind: activeKind, createdUtc: new Date().toISOString() })); setAnswers({}); celebrate('Checklist sent'); })
      .catch((err: Error) => setError(`${err.message} Your answers are kept; you can send it again.`))
      .then(() => { inFlight.current = false; setSending(false); }, () => { inFlight.current = false; setSending(false); });
  };

  return (
    <div className={styles.stack}>
      {eligible.length === 0 ? (
        <Empty>You have no approved booking today or in the next 24 hours, so there is no checklist to complete.</Empty>
      ) : (
        <ModuleCard title="Checklist" icon="clipboard-check" focal ariaLabel="Checklist">
          <fieldset className={styles.fieldset}>
            <legend className={styles.sectionLabel}>Which booking?</legend>
            <div className={styles.spaceCards}>
              {eligible.map(b => {
                const p = dateParts(b.startUtc, b.endUtc, tz);
                return (
                  <label key={b.requestId} className={`${styles.spaceCard} ${bookingId === b.requestId ? styles.spaceOn : ''}`}>
                    <input type="radio" name="booking" checked={bookingId === b.requestId} onChange={() => chooseBooking(b.requestId)} />
                    <strong>{p.weekday} {p.month} {p.day}, {p.time}</strong>
                    <span className={s.kitChips}>{((ch: string[]) => ch.slice(0, 2).map(c => <i key={c}>{c}</i>).concat(ch.length > 2 ? [<i key="more">+{ch.length - 2}</i>] : []))(equipmentChips(b.space, b.equipmentIds, props.resources || []))}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className={styles.segment} role="group" aria-label="Checklist type" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['Entry', 'Exit', 'Wellness'] as CheckInKind[]).map(k => (
              <button key={k} type="button" className={`${styles.segmentBtn} ${activeKind === k ? styles.segmentOn : ''}`} aria-pressed={activeKind === k} aria-label={k === 'Entry' ? 'Arriving: entry checklist' : k === 'Exit' ? 'Leaving: exit checklist' : 'Team wellness'}
                onClick={() => { setKind(k); setAnswers({}); setError(undefined); }}>
                {k === 'Entry' ? 'Arriving' : k === 'Exit' ? 'Leaving' : 'Wellness'}
              </button>
            ))}
          </div>
          {closesIn !== undefined && <span className={s.wlChip} role="status">Check-in closes in {closesIn} min</span>}

          {activeKind === 'Wellness' ? (
            bookingId
              ? <WellnessCheck key={bookingId} roster={data.data.roster} source={source} facilityId={facility.facilityId} timeZone={tz} bookingId={bookingId} questions={questions} onDone={() => { setKind('Entry'); data.reload(); }} />
              : <Empty>Choose a booking first.</Empty>
          ) : found.sent ? (
            <div aria-live="polite" aria-label="Checklist already sent">
              <ModuleRow avatar={<RefIcon name="check" size={16} />} tone="teal" title={`${activeKind} checklist already sent`}
                sub={`Sent ${sentWhen(found.sent)} for ${chosen ? ((p) => `${p.weekday} ${p.month} ${p.day}, ${p.time}`)(dateParts(chosen.startUtc, chosen.endUtc, tz)) : 'this booking'}`}
                status={recordState(found.sent).state === 'recorded' ? 'Recorded' : 'Sent'} statusTone={recordState(found.sent).state === 'recorded' ? 'ok' : 'wait'} />
              {activeKind === 'Entry' && (
                <div className={rx['modal-footer']} style={{ borderTop: 0, justifyContent: 'flex-start', paddingTop: 12 }}>
                  <button type="button" className={rx['primary-button']} onClick={() => { setKind('Wellness'); setAnswers({}); }}>Next: Team wellness</button>
                </div>
              )}
            </div>
          ) : questions.length === 0 ? (
            <Empty>Flavors has not set up the {activeKind.toLowerCase()} checklist yet.</Empty>
          ) : (
            <>
              {refusedNow && <p className={rx['module-lede']} role="status">{recordState(refusedNow).text.replace(/[.\s]*$/, '')}. Please send it again.</p>}
              <ChecklistStepper key={`${bookingId}-${activeKind}`} questions={questions} answers={answers} onAnswer={(id, a) => setAnswers(prev => ({ ...prev, [id]: a }))} onSend={send} sending={sending} canSend={!!bookingId && prog.complete} />
            </>
          )}

          {activeKind !== 'Wellness' && (
            <>
              <ErrorBar error={error} onDismiss={() => setError(undefined)} />
            </>
          )}
        </ModuleCard>
      )}

      <ModuleCard title="Sent checklists" count={`${data.data.history.length}`}>
        {data.data.history.length === 0 ? <Empty>None yet.</Empty> : (
          <div className={rx['module-booking-list']}>
            {data.data.history.slice().reverse().slice(0, 20).map(h => {
              const r = recordState(h);
              return (
                <ModuleRow key={h.submissionId} avatar={h.kind.charAt(0)} tone={r.state === 'recorded' ? 'teal' : r.state === 'not-recorded' ? 'slate' : 'gold'}
                  title={h.kind === 'Wellness' ? `Wellness: ${h.personName || 'team member'}` : `${h.kind} checklist`} sub={sentChecklistLabel(h, byId.get(h.bookingId), tz)}
                  status={r.state === 'recorded' ? 'Recorded' : r.state === 'not-recorded' ? 'Not recorded' : 'Sent'} statusTone={r.state === 'recorded' ? 'ok' : r.state === 'not-recorded' ? 'bad' : 'wait'}
                  extra={r.state === 'not-recorded' ? <span>{r.text}</span> : undefined} />
              );
            })}
          </div>
        )}
      </ModuleCard>
    </div>
  );
}

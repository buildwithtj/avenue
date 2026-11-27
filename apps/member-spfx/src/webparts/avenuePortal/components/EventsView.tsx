import * as React from 'react';
import s from './Site.module.scss';
import { EVENT_PACKAGES, type EventPackage, type IMyEventRequest } from '../../../avenue/contracts';
import { formatCents, formatPrice } from '../../../avenue/billing';
import { localDay } from '../../../avenue/calendar';
import { DINING_SEATS, EXTRA_HOUR_CENTS, DEPOSIT_CENTS, PACKAGES, eventQuote, validateEvent } from '../../../avenue/events';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { toast, celebrate } from './feedback';
import rx from './Ref.module.scss';
import { ModuleCard } from './RefUi';
import { Empty, RequestStatus, formatDate, useCalendarDay, useLoad, LoadError } from './ui';

export interface IEventsViewProps { source: AvenueReadSource; facilityId: string; timeZone: string }

// Private event request for the dining room (member rates). Sending this charges nothing: Flavors approves, then invoices the
// deposit and the package. Refund rules are still open with the client (Q8/Q9), so none are shown.
export default function EventsView(props: IEventsViewProps): React.ReactElement {
  const { source, facilityId, timeZone } = props;
  const today: string = localDay(new Date(), timeZone);
  const mine = useLoad<IMyEventRequest[]>(() => source.listMyEventRequests(), [source]);
  const [pkg, setPkg] = React.useState<EventPackage | ''>('');
  const [date, setDate] = React.useState<string>('');
  const [guests, setGuests] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  // Plan F3: tell the member when the chosen day already has approved bookings (informational; Flavors confirms either way).
  const validDate: boolean = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  const day = useCalendarDay(source, validDate ? date : today);
  const dayBooked: number = validDate && day.ready ? day.entries.length : 0;
  const input = { facilityId, pkg, eventDate: date, guests: Number(guests), notes };
  const quote = pkg && date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today ? eventQuote(pkg, date, today, Number(guests) || 0) : undefined;

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const errors: string[] = validateEvent(input, today);
    if (errors.length > 0) { setError(errors.join(' ')); return; }
    setBusy(true); setError(undefined);
    source.submitEventRequest(input, newSubmissionId('evt'), today)
      .then(() => { toast('Event request sent. Nothing was charged.'); celebrate('Request sent'); setBusy(false); setPkg(''); setDate(''); setGuests(''); setNotes(''); mine.reload(); })
      .catch((err: Error) => { setError(err.message); setBusy(false); });
  };

  return (
    <section className={s.nm} aria-label="Event request">
      <ModuleCard title="Event request">
        <p className={rx['module-lede']}>Flavors confirms every request; sending one charges nothing.</p>
      <form className={s.nmForm} onSubmit={submit}>
        <fieldset className={s.nmPkgs}>
          <legend>Package</legend>
          {EVENT_PACKAGES.map(p => (
            <label key={p} className={s.nmPkg} data-on={pkg === p ? 'true' : 'false'}>
              <input type="radio" name="evt-pkg" value={p} checked={pkg === p} onChange={() => setPkg(p)} />
              <strong>{p}</strong><span>{PACKAGES[p].hours} hours</span><b>{formatPrice(PACKAGES[p].priceCents)}</b>
            </label>
          ))}
        </fieldset>
        <label>Event date<input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
          {dayBooked > 0 && <span className={s.cwHint} role="status">{`That date already has ${dayBooked === 1 ? 'a booking' : `${dayBooked} bookings`} in the kitchen. Flavors will confirm whether your event fits.`}</span>}
        </label>
        <label>Guests (dining room seats {DINING_SEATS})<input type="number" inputMode="numeric" min={1} max={60} value={guests} onChange={e => setGuests(e.target.value)} /></label>
        <label className={s.cwWide}>Notes (optional)<textarea rows={3} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} /></label>
        <div className={`${s.nmQuote} ${s.cwWide}`} aria-live="polite">
          {quote ? (
            <>
              <p><strong>{formatCents(quote.packageCents)}</strong> for {quote.hours} hours (extra hours {formatCents(EXTRA_HOUR_CENTS)} each).</p>
              <p><strong>{formatCents(quote.depositCents)}</strong> refundable deposit, invoiced when Flavors approves.</p>
              <p>Package balance due {quote.balanceDueNow ? 'at once, because the event is less than 30 days away' : `on ${formatDate(quote.balanceDueYmd)}, 30 days before the event`}.</p>
              {quote.overSeats && <p>More than {DINING_SEATS} guests needs extra seating. Flavors will quote it.</p>}
            </>
          ) : <p>Choose a package and a date to see the price and when it is due. A {formatPrice(DEPOSIT_CENTS)} deposit applies to every event.</p>}
        </div>
        {error && <p className={s.cwErr} role="alert">{error}</p>}
        <div className={s.cwActions}><button type="submit" className={s.cwYes} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
      </form>
      </ModuleCard>
      <ModuleCard title="Your requests">
      <LoadError error={mine.error} what="your event requests" onRetry={mine.reload} />
      {mine.data && mine.data.length === 0 && <Empty>No event requests yet.</Empty>}
      <ul className={s.nmList}>
        {(mine.data || []).map(r => (
          <li key={r.id} className={s.nmItem}>
            <strong>{r.pkg} · {formatDate(r.eventDate)}</strong><small>{r.guests} guests{r.notes ? ` · ${r.notes}` : ''}</small>
            <RequestStatus outcome={r.outcome} reply={r.reply} />
          </li>
        ))}
      </ul>
      </ModuleCard>
    </section>
  );
}

import * as React from 'react';
import s from './Site.module.scss';
import { STORAGE_ITEMS, type IMyStorageRequest, type StorageItem } from '../../../avenue/contracts';
import { formatCents } from '../../../avenue/billing';
import { estimateCents, offerFor, OFFERS, validateStorage } from '../../../avenue/storage';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { toast } from './feedback';
import { Empty, RequestStatus, useLoad, LoadError } from './ui';

export interface IStorageViewProps { source: AvenueReadSource; facilityId: string }

// Storage rental request. Not a booking: Flavors confirms availability and the price, and bills by hand. Items the client sheet does not price clearly say so.
export default function StorageView(props: IStorageViewProps): React.ReactElement {
  const { source, facilityId } = props;
  const mine = useLoad<IMyStorageRequest[]>(() => source.listMyStorageRequests(), [source]);
  const [item, setItem] = React.useState<StorageItem | ''>('');
  const [qty, setQty] = React.useState<string>('1');
  const [notes, setNotes] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const input = { facilityId, item, quantity: Number(qty), notes };
  const offer = item ? offerFor(item) : undefined;
  const est: number | undefined = item ? estimateCents(item, Number(qty) || 0) : undefined;

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const errors: string[] = validateStorage(input);
    if (errors.length > 0) { setError(errors.join(' ')); return; }
    setBusy(true); setError(undefined);
    source.submitStorageRequest(input, newSubmissionId('sto'))
      .then(() => { toast('Storage request sent. Nothing was charged.'); setBusy(false); setItem(''); setQty('1'); setNotes(''); mine.reload(); })
      .catch((err: Error) => { setError(err.message); setBusy(false); });
  };

  return (
    <section className={s.nm} aria-label="Storage request">
      <header className={s.nmHead}><div><h2>Storage</h2><p className={s.cwHelp}>Ask for fridge, freezer or dry storage. Flavors confirms availability and the price before anything is billed.</p></div></header>
      <form className={s.nmForm} onSubmit={submit}>
        <label>What do you need?
          <select value={item} onChange={e => setItem(e.target.value as StorageItem | '')}>
            <option value="">Choose…</option>
            {STORAGE_ITEMS.map(i => { const o = OFFERS.filter(x => x.item === i)[0]; return <option key={i} value={i}>{o.label}{o.cents !== undefined ? ` · ${formatCents(o.cents)} ${o.per}` : ' · price on request'}</option>; })}
          </select>
        </label>
        <label>Quantity<input type="number" inputMode="numeric" min={1} max={20} value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label className={s.cwWide}>Notes (optional)<textarea rows={3} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} /></label>
        <div className={`${s.nmQuote} ${s.cwWide}`} aria-live="polite">
          {!offer ? <p>Choose an item to see its price.</p>
            : est !== undefined ? <><p><strong>About {formatCents(est)}</strong> {offer.per.indexOf('day') >= 0 ? 'per day' : 'per month'} for {Number(qty) || 0}, before Flavors confirms.</p>{offer.note && <p>{offer.note}</p>}</>
            : <p>Price on request. Flavors replies with a price.</p>}
        </div>
        {error && <p className={s.cwErr} role="alert">{error}</p>}
        <div className={s.cwActions}><button type="submit" className={s.cwYes} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
      </form>
      <h3 className={s.nmSub}>Your requests</h3>
      <LoadError error={mine.error} what="your storage requests" onRetry={mine.reload} />
      {mine.data && mine.data.length === 0 && <Empty>No storage requests yet.</Empty>}
      <ul className={s.nmList}>
        {(mine.data || []).map(r => (
          <li key={r.id} className={s.nmItem}>
            <strong>{(offerFor(r.item) || { label: r.item }).label} × {r.quantity}</strong>{r.notes && <small>{r.notes}</small>}
            <RequestStatus outcome={r.outcome} reply={r.reply} />
          </li>
        ))}
      </ul>
    </section>
  );
}

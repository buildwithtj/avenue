import * as React from 'react';
import { scrollMainTo } from './smoothScroll';
import s from './Site.module.scss';
import type { IFacility, IPlan } from '../../../avenue/contracts';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { formatPrice } from '../../../avenue/billing';
import { DEPOSIT_CENTS, EXTRA_HOUR_CENTS, PACKAGES } from '../../../avenue/events';
import { OFFERS } from '../../../avenue/storage';
import { tabOn } from '../../../avenue/release';
import type { TabKey } from './AvenuePortal';
import { useLoad } from './ui';
import rx from './Ref.module.scss';
import { ModuleCard } from './RefUi';

export interface IPoliciesViewProps {
  source: AvenueReadSource;
  facility: IFacility;
  onNavigate: (t: TabKey) => void;
}

/** Section ids, so the footer can jump straight to one. */
export const POLICY_SECTIONS: { id: string; title: string }[] = [
  { id: 'booking', title: 'Booking' },
  { id: 'cancelling', title: 'Cancelling' },
  { id: 'payments', title: 'Plans and payments' },
  { id: 'documents', title: 'Documents' },
  { id: 'events', title: 'Events and storage' },
  { id: 'terms', title: 'Terms and privacy' }
];

/**
 * One page for the rules a member needs, built only from what the client confirmed (client sheet 19 Nov 2026, facility rules
 * in AvenueFacilities, plans in AvenuePlans). Wording the client has not supplied (terms, privacy, contact details) says so.
 */
export default function PoliciesView(props: IPoliciesViewProps): React.ReactElement {
  const f: IFacility = props.facility;
  const early: number = f.earlyEntryMinutes === undefined ? 30 : f.earlyEntryMinutes;
  const clean: number = f.cleanupMinutes === undefined ? 30 : f.cleanupMinutes;
  const prep: number = f.minPrepTables === undefined ? 2 : f.minPrepTables;
  const plans = useLoad<IPlan[]>(() => props.source.listPlans().catch((): IPlan[] => []), [props.source]);
  const open: IPlan[] = (plans.data || []).filter(p => p.openToNew !== false && p.priceCents !== undefined);
  const jump = (id: string): void => { const el: HTMLElement | null = document.getElementById(`policy-${id}`); if (el) { scrollMainTo(el); } };
  return (
    <div className={s.pol}>
      <nav className={s.polToc} aria-label="On this page">
        {POLICY_SECTIONS.map(x => <button key={x.id} type="button" onClick={() => jump(x.id)}>{x.title}</button>)}
      </nav>
      <div className={s.polBody}>
        <ModuleCard id="policy-booking" title="Booking">
          <ul>
            <li>The kitchen is open 24 hours. Members have their own door code.</li>
            <li>Book equipment by the hour, in whole or half hours, for at least one hour. Every request waits for Flavors to confirm it.</li>
            <li>You may come in {early} minutes before your booking to set up and stay {clean} minutes after to clean. That time is free and not taken from your hours.</li>
            <li>Every equipment booking includes at least {prep} prep tables.</li>
            <li>Plan hours reset each month and do not roll over. Extra hours are billed with your next payment.</li>
          </ul>
          {tabOn('book') && <button type="button" className={rx['primary-button']} onClick={() => props.onNavigate('book')}>Book kitchen time</button>}
        </ModuleCard>
        <ModuleCard id="policy-cancelling" title="Cancelling">
          <ul>
            <li>Cancel 24 hours or more before the start and your hours come back.</li>
            <li>Closer than 24 hours, ask Flavors from My bookings. Flavors decides.</li>
          </ul>
        </ModuleCard>
        <ModuleCard id="policy-payments" title="Plans and payments">
          <ul>
            <li>Your plan is collected once a month on your collection day.</li>
            <li>3% is added to payments made electronically by card.</li>
            <li>Extra hours over your plan are charged at your plan’s extra-hour rate with your next payment.</li>
          </ul>
          {open.length > 0 && (
            <div className={s.polTable} role="region" aria-label="Plans" tabIndex={0}>
              <table>
                <thead><tr><th scope="col">Plan</th><th scope="col">Per month</th><th scope="col">Hours</th><th scope="col">Extra hour</th></tr></thead>
                <tbody>{open.map(p => <tr key={p.planId}><th scope="row">{p.name}</th><td>{formatPrice(p.priceCents as number)}</td><td>{p.monthlyHours === undefined ? '-' : `${p.monthlyHours} h`}</td><td>{p.extraHourRate === undefined ? '-' : formatPrice(Math.round(p.extraHourRate * 100))}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {tabOn('membership') && <button type="button" className={rx['secondary-button']} onClick={() => props.onNavigate('membership')}>See my plan</button>}
        </ModuleCard>
        <ModuleCard id="policy-documents" title="Documents">
          <ul>
            <li>Keep these current: county food service permit, Maryland good standing, liability insurance, workers’ compensation (or waiver), food safety manager certificate, food manager’s card, and a food handler or manager card for each team member.</li>
            <li>Avenue reminds you 30, 15 and 10 days before a document expires.</li>
            <li>With an expired document you cannot book until you upload a current one.</li>
          </ul>
          {tabOn('documents') && <button type="button" className={rx['secondary-button']} onClick={() => props.onNavigate('documents')}>Open my documents</button>}
        </ModuleCard>
        <ModuleCard id="policy-events" title="Events and storage">
          <p>Private events use the dining room. Member packages:</p>
          <ul>{Object.keys(PACKAGES).map(k => <li key={k}>{`${k}: ${PACKAGES[k as keyof typeof PACKAGES].hours} h, ${formatPrice(PACKAGES[k as keyof typeof PACKAGES].priceCents)}`}</li>)}</ul>
          <p>Extra hours {formatPrice(EXTRA_HOUR_CENTS)} each. A refundable deposit of {formatPrice(DEPOSIT_CENTS)} applies to every event; the balance is due 30 days before the event.</p>
          <p>Storage on request:</p>
          <ul>{OFFERS.filter(o => o.cents !== undefined).map(o => <li key={o.label}>{`${o.label}: ${formatPrice(o.cents as number)} per ${o.per}`}</li>)}</ul>
          <p>Flavors confirms the price before billing.</p>
        </ModuleCard>
        <ModuleCard id="policy-terms" title="Terms and privacy">
          <p>Flavors will publish its membership terms and privacy notice here. Until then, ask Flavors for a copy.</p>
          {tabOn('support') && <button type="button" className={rx['secondary-button']} onClick={() => props.onNavigate('support')}>Message Flavors</button>}
        </ModuleCard>
      </div>
    </div>
  );
}

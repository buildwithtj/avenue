import * as React from 'react';
import { DefaultButton, Spinner } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import type { IFacility, IMyMembership, IMyRequest } from '../../../avenue/contracts';
import type { AvenueReadSource } from '../../../avenue/readSource';
import { hoursThisMonth } from '../../../avenue/booking';
import { hoursSummary } from '../../../avenue/home';
import { Empty, ordinal, useLoad } from './ui';

export interface IMembershipViewProps {
  source: AvenueReadSource;
  userEmail: string;
}

interface IMembershipData {
  membership?: IMyMembership;
  facility: IFacility;
  requests: IMyRequest[];
}

// The member's own plan, allowance and status. Hours do not roll over and extra hours are billed with the next payment (D5).
// No payment-method section: payments are not connected, and nothing about prices is shown (Q-04).
export default function MembershipView(props: IMembershipViewProps): React.ReactElement {
  const { source, userEmail } = props;
  const data = useLoad<IMembershipData>(async () => {
    const [membership, facility, requests] = await Promise.all([
      source.getMyMembership(userEmail).catch(() => undefined),
      source.getFacility(),
      source.listMyRequests()
    ]);
    return { membership, facility, requests };
  }, [source, userEmail]);

  if (data.error) {
    return (
      <div className={styles.errorPanel} role="alert">
        <strong>We could not load your membership.</strong><span>{data.error}</span>
        <DefaultButton text="Try again" onClick={data.reload} />
      </div>
    );
  }
  if (!data.data) { return <Spinner label="Loading membership" />; }

  const m: IMyMembership | undefined = data.data.membership;
  const hours = hoursSummary(hoursThisMonth(data.data.requests, data.data.facility.timeZone, new Date()), m?.monthlyHours);
  const known = (v: string | undefined): string => v || 'Not set yet';

  if (!m) {
    return <Empty>Your membership details appear here once Flavors has set up your account.</Empty>;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.memberHero} aria-label="My membership">
        <div className={styles.eyebrow}>Membership</div>
        <h2 className={styles.memberName}>{known(m.businessName)}</h2>
        <div className={styles.memberMeta}>
          <span className={`${styles.statusPill} ${m.status === 'Active' ? styles.statusOk : styles.statusWaiting}`}>{known(m.status)}</span>
          <span>Plan: {known(m.planName || m.planId)}</span>
        </div>
      </section>

      <section aria-label="Hours this month">
        <h2 className={styles.sectionLabel}>This month</h2>
        <div className={styles.summaryButton}>
          {hours.allowance !== undefined ? (
            <>
              <span className={styles.summaryValue}>{hours.over > 0 ? `${hours.over} h over your plan` : `${hours.left} h left`}</span>
              <span className={styles.meter} aria-hidden="true"><span className={`${styles.meterFill} ${hours.over > 0 ? styles.meterOver : ''}`} style={{ width: `${Math.round(hours.fraction * 100)}%` }} /></span>
              <span className={styles.summaryNote}>{hours.used} of {hours.allowance} h used. Hours do not roll over. Extra hours are billed with your next payment.</span>
            </>
          ) : (
            <>
              <span className={styles.summaryValue}>{hours.used} h booked</span>
              <span className={styles.summaryNote}>Your plan hours appear once Flavors sets up plans.</span>
            </>
          )}
        </div>
      </section>

      <section aria-label="Details">
        <h2 className={styles.sectionLabel}>Details</h2>
        <dl className={styles.factList}>
          <div><dt>Monthly allowance</dt><dd>{m.monthlyHours !== undefined ? `${m.monthlyHours} h` : 'Not set yet'}</dd></div>
          <div><dt>Collection day</dt><dd>{m.collectionDay !== undefined ? `The ${ordinal(m.collectionDay)} of each month` : 'Not set yet'}</dd></div>
          <div><dt>Account e-mail</dt><dd>{userEmail}</dd></div>
        </dl>
        <p className={styles.muted}>To change your plan or details, contact Flavors.</p>
      </section>
    </div>
  );
}

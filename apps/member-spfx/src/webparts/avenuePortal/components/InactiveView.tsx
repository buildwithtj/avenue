import * as React from 'react';
import s from './Site.module.scss';

/**
 * Plan F2: shown instead of Join to someone whose membership was ended. Deactivation deletes the member's own membership
 * row (fail closed), so the portal cannot read "inactive"; a former member is recognised by their own earlier booking
 * requests. [PROPOSED] wording; the flows already refuse new requests either way.
 */
export default function InactiveView(props: { facilityTitle: string }): React.ReactElement {
  return (
    <section className={s.inactive} aria-labelledby="inactive-title">
      <h1 id="inactive-title" className={s.pageTitle}>Your membership is not active</h1>
      <p>You can no longer book or send requests at {props.facilityTitle}. Your earlier bookings are kept.</p>
      <p>If you think this is a mistake, or you want to start again, please contact the Flavors team at the facility.</p>
    </section>
  );
}

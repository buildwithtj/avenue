import * as React from 'react';
import { celebrate } from './feedback';
import { MessageBar, MessageBarType } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import { ALLOWED_EXTENSIONS, validateDocument } from '../../../avenue/documents';
import { DOC_TYPES, type DocType, type IMyDocumentSubmission } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { documentCards } from '../../../avenue/home';
import ComplianceWizard from './ComplianceWizard';
import s from './Site.module.scss';
import { flagState, hasHold, onboarding, requiredOrSheet, requiredRows, requiredSummary, type IRequiredRow, type RequiredState } from '../../../avenue/compliance';
import type { IMyMembership } from '../../../avenue/contracts';
import type { IMyFlag } from '../../../avenue/contracts';
import rx from './Ref.module.scss';
import { EmptyState, ModuleCard, ModuleRow, StatCard } from './RefUi';
import { ErrorBar, formatDate, LoadError, useLoad } from './ui';

export interface IDocumentsViewProps {
  source: AvenueReadSource;
  /** The facility's time zone, so "expired today" matches Home and the flows. */
  timeZone: string;
  /** Staff page only (see the web part setting). */
  staffUpload?: boolean;
  /** The signed-in member, for the onboarding checklist. */
  userEmail?: string;
}


const STATE_LABEL: Record<RequiredState, string> = { current: 'Current', waiting: 'Waiting for verification', expiring: 'Expiring', expired: 'Expired', missing: 'Missing' };

const STATE_ICON: Record<RequiredState, string> = { current: 'M5 12.5l4.5 4.5L19 7.5', waiting: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', expiring: 'M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', expired: 'M6.5 6.5l11 11M17.5 6.5l-11 11', missing: 'M12 5v14M5 12h14' };

/** One required document: a header (icon, name, status chip) that opens an animated panel with the detail and the upload action. */
function DocRow(props: { row: IRequiredRow; index: number; open: boolean; onToggle: () => void; onUpload: () => void }): React.ReactElement {
  const { row, open } = props;
  const id: string = `dc-${row.type.replace(/[^A-Za-z0-9]+/g, '-')}`;
  return (
    <div className={`${rx['dc-row']} ${rx[`is-${row.state}`]} ${open ? rx['is-open'] : ''}`} style={{ ['--i' as string]: props.index } as React.CSSProperties}>
      <button type="button" className={rx['dc-head']} aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-head`} onClick={props.onToggle}>
        <span className={rx['dc-ico']} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STATE_ICON[row.state]} /></svg></span>
        <span className={rx['dc-name']}><b>{row.type}</b><span>{row.doc ? `Expires ${formatDate(row.doc.expiryDate)}` : 'Not sent yet'}</span></span>
        <span className={rx['dc-chip']}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={STATE_ICON[row.state]} /></svg>{STATE_LABEL[row.state]}</span>
        <svg className={rx['dc-chev']} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className={rx['dc-panel']} id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`}>
        <div><div className={rx['dc-body']}>
          <span>{rowDetail(row)}</span>
          <div><button type="button" className={rx['primary-button']} tabIndex={open ? 0 : -1} onClick={props.onUpload} aria-label={`Upload ${row.type}`}>{row.doc ? 'Upload new' : 'Upload'}</button></div>
        </div></div>
      </div>
    </div>
  );
}

/** Completeness ring: the arc grows from empty to the share of current documents. */
function Ring(props: { pct: number }): React.ReactElement {
  const [shown, setShown] = React.useState<number>(0);
  React.useEffect(() => { const t: number = window.setTimeout(() => setShown(props.pct), 30); return () => window.clearTimeout(t); }, [props.pct]);
  return (
    <div className={rx['dc-ring']} role="img" aria-label={`${Math.round(props.pct)} percent of required documents current`}>
      <svg viewBox="0 0 36 36"><circle className={rx.track} cx="18" cy="18" r="15.915" pathLength={100} /><circle className={rx.arc} cx="18" cy="18" r="15.915" pathLength={100} style={{ strokeDashoffset: 100 - shown }} /></svg>
      <b>{Math.round(props.pct)}%</b>
    </div>
  );
}

function rowDetail(r: IRequiredRow): string {
  if (!r.doc) { return 'Not sent yet.'; }
  if (r.rejected) { return r.doc.outcome || 'Not accepted. Please send it again.'; }
  if (r.state === 'expired') { return `Expired ${formatDate(r.doc.expiryDate)}. You cannot book until a current one is on file.`; }
  const left: string = r.daysLeft === 0 ? 'today' : r.daysLeft === 1 ? 'tomorrow' : `in ${r.daysLeft} days`;
  if (r.state === 'expiring') { return `Expires ${left} (${formatDate(r.doc.expiryDate)}). ${r.warn !== undefined ? `${r.warn}-day reminder: ` : ''}send the renewal.`; }
  return r.state === 'waiting' ? `Expires ${formatDate(r.doc.expiryDate)}. Flavors will verify it.` : `Verified. Expires ${formatDate(r.doc.expiryDate)}.`;
}

// Permits, licences, insurance and certifications (CMP-01). Files go to the member's own submission and are copied by
// a flow into a private library only Flavors can read. Expired documents block new bookings unless the owner overrides.
export default function DocumentsView(props: IDocumentsViewProps): React.ReactElement {
  const { source, timeZone, staffUpload } = props;
  const userEmail: string = props.userEmail || '';
  const flags = useLoad<IMyFlag[]>(() => source.listMyFlags().catch((): IMyFlag[] => []), [source]);
  const required = useLoad<DocType[]>(() => source.listRequiredDocTypes().catch((): DocType[] => []), [source]);
  const membership = useLoad<IMyMembership | undefined>(() => source.getMyMembership(userEmail).catch(() => undefined), [source, userEmail]);
  const [forMember, setForMember] = React.useState<string>('');
  const [openRow, setOpenRow] = React.useState<string>('');
  const docs = useLoad<IMyDocumentSubmission[]>(() => source.listMyDocuments(), [source]);
  const [docType, setDocType] = React.useState<DocType | undefined>();
  const [issueDate, setIssueDate] = React.useState<string>('');
  const [expiryDate, setExpiryDate] = React.useState<string>('');
  const [file, setFile] = React.useState<File | undefined>();
  const [errors, setErrors] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState<boolean>(false);
  const [sent, setSent] = React.useState<boolean>(false);
  const fileInput: React.RefObject<HTMLInputElement> = React.useRef<HTMLInputElement>(null);
  const formRef: React.RefObject<HTMLFormElement> = React.useRef<HTMLFormElement>(null);
  const issueInput: React.RefObject<HTMLInputElement> = React.useRef<HTMLInputElement>(null);

  // "Upload" on a required row opens the one upload form below, preset to that type.
  const startUpload = (type: DocType): void => {
    setDocType(type); setSent(false); setErrors([]);
    if (formRef.current && typeof formRef.current.scrollIntoView === 'function') { formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    window.setTimeout(() => { if (issueInput.current) { issueInput.current.focus({ preventScroll: true }); } }, 0);
  };

  const today: string = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const inFlight: React.MutableRefObject<boolean> = React.useRef<boolean>(false);
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const input = { facilityId: source.facilityId, docType, issueDate, expiryDate, file: file ? { name: file.name, size: file.size } : undefined, ...(staffUpload && forMember.trim() ? { onBehalfOf: forMember } : {}) };
    const problems: string[] = validateDocument(input);
    setErrors(problems);
    if (problems.length > 0 || !file) {
      return;
    }
    if (inFlight.current) { return; }
    inFlight.current = true;
    setSending(true);
    source.submitDocument(input, file, newSubmissionId('doc'))
      .then(() => {
        setSent(true);
        celebrate('Document sent');
        setDocType(undefined);
        setIssueDate('');
        setExpiryDate('');
        setFile(undefined);
        if (fileInput.current) {
          fileInput.current.value = '';
        }
        docs.reload();
      })
      // Our own validation text is shown as is; a raw server error becomes a plain sentence (A3).
      .catch((err: Error) => setErrors([/^SharePoint returned|Failed to fetch|NetworkError/i.test(err.message) ? 'We could not send your document. Check your connection and try again.' : err.message.replace(/^Avenue: /, '')]))
      .then(() => { inFlight.current = false; setSending(false); }, () => { inFlight.current = false; setSending(false); });
  };

  return (
    <div className={styles.stack}>
      {!staffUpload && docs.data && required.data && membership.data !== undefined && (() => {
        const ob = onboarding(membership.data, docs.data, required.data, today);
        return ob.complete ? null : (
          <section className={s.cwCases} aria-label="Getting started">
            <h2 className={styles.sectionLabel}>Getting started</h2>
            {ob.steps.map(st => (
              <div key={st.key} className={`${s.cwCase} ${st.done ? '' : s.cwCaseInfo}`}>
                <strong>{st.done ? 'Done: ' : 'To do: '}{st.label}</strong>
                <span>{st.detail}</span>
              </div>
            ))}
          </section>
        );
      })()}
      {!staffUpload && flags.data && hasHold(flags.data) && <div className={s.cwBanner} role="alert"><strong>New bookings are paused.</strong> Flavors is reviewing a compliance issue on your account. Follow the instructions below or contact management.</div>}
      {!staffUpload && flags.data && flags.data.length > 0 && (
        <section aria-label="Your compliance cases" className={s.cwCases}>
          <h2 className={styles.sectionLabel}>Your compliance cases</h2>
          {flags.data.map(f => { const st = flagState(f.outcome); return (
            <div key={f.submissionId} className={`${s.cwCase} ${st.state === 'hold' ? s.cwCaseHold : st.state === 'info' ? s.cwCaseInfo : ''}`}>
              <strong>{f.docType}: {f.reason}</strong>
              <span>{st.state === 'open' ? 'Waiting for Flavors to review.' : st.text}</span>
            </div>); })}
        </section>
      )}
      {!staffUpload && <LoadError error={docs.error} what="your documents" onRetry={docs.reload} />}
      {!docs.data && !docs.error && <div className={rx['ref-skeleton']} role="status" aria-label="Loading your documents" />}
      {!staffUpload && docs.data && required.data && (() => {
        const rows: IRequiredRow[] = requiredRows(requiredOrSheet(required.data), docs.data, today);
        const n = requiredSummary(rows);
        return (
          <ModuleCard title="Required documents" count={`${n.current} of ${rows.length} current`} className={s.dcReq}>
            <div className={rx['dc-top']}>
              <Ring pct={rows.length ? (100 * n.current) / rows.length : 0} />
              <div className={rx['dc-legend']}><b>{n.current} of {rows.length} required documents current</b><small>{n.missing + n.expired > 0 ? `${n.missing + n.expired} still to send` : 'Nothing missing'}{n.expiring > 0 ? ` · ${n.expiring} expiring soon` : ''}</small></div>
            </div>
            <div className={rx['module-stat-grid']} role="list" aria-label="Summary" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              <div role="listitem"><StatCard icon="shield-check" title={`${n.current} current`} sub="Verified and in date" pct={rows.length ? (100 * n.current) / rows.length : 0} /></div>
              <div role="listitem"><StatCard icon="clock-3" title={`${n.waiting} waiting`} sub="Waiting for verification" /></div>
              <div role="listitem"><StatCard icon="file-text" title={`${n.expiring} expiring`} sub="Send the renewal soon" /></div>
              <div role="listitem"><StatCard icon="clipboard-check" title={`${n.missing + n.expired} to send`} sub="Missing or expired" /></div>
            </div>
            {required.data.length === 0 && <p className={styles.muted}>Flavors has not confirmed its required list yet; these are the documents on its compliance sheet.</p>}
            <div className={rx['dc-rows']}>
              {rows.map((row, i) => <DocRow key={row.type} row={row} index={i} open={openRow === row.type} onToggle={() => setOpenRow(openRow === row.type ? '' : row.type)} onUpload={() => startUpload(row.type)} />)}
            </div>
          </ModuleCard>
        );
      })()}
      <ModuleCard title="Send a document">
        <p className={styles.muted} style={{ margin: '0 0 14px' }}>Permits, licences, insurance and certifications. Flavors checks each one.</p>
        {sent && <div className={rx['dc-fresh']}><MessageBar messageBarType={MessageBarType.success} onDismiss={() => setSent(false)}>Document sent. Its status appears below.</MessageBar></div>}
        <form ref={formRef} onSubmit={submit} noValidate aria-label="Send a document" style={{ maxWidth: 640 }}>
          {staffUpload && (
            <label className={rx['modal-field']} htmlFor="avenue-doc-for">For member (their sign-in e-mail; leave empty for yourself)
              <input id="avenue-doc-for" type="email" value={forMember} onChange={e => setForMember(e.target.value)} />
            </label>
          )}
          <label className={rx['modal-field']} htmlFor="avenue-doc-type">Type
            <select id="avenue-doc-type" value={docType || ''} onChange={e => setDocType(e.target.value ? (e.target.value as DocType) : undefined)} required>
              <option value="">Choose a type</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className={rx['modal-row']}>
            <label className={rx['modal-field']} htmlFor="avenue-doc-issue">Issue date
              <input id="avenue-doc-issue" ref={issueInput} type="date" value={issueDate} max={today} onChange={e => setIssueDate(e.target.value)} required />
            </label>
            <label className={rx['modal-field']} htmlFor="avenue-doc-expiry">Expiry date
              <input id="avenue-doc-expiry" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
            </label>
          </div>
          <label className={rx['modal-field']} htmlFor="avenue-doc-file">File (PDF, JPEG or PNG, up to 10 MB)
            <input id="avenue-doc-file" ref={fileInput} type="file" accept={ALLOWED_EXTENSIONS.map(x => `.${x}`).join(',')} onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} required />
          </label>
          <div style={{ marginBottom: 12 }}><ErrorBar error={errors.length ? errors.join(' ') : undefined} onDismiss={() => setErrors([])} /></div>
          <button type="submit" className={rx['primary-button']} disabled={sending}>{sending ? 'Sending…' : 'Send document'}</button>
        </form>
      </ModuleCard>

      <ModuleCard title="My documents" count={docs.data ? `${docs.data.length} sent` : undefined} actions={<button type="button" className={rx['secondary-button']} onClick={docs.reload}>Refresh</button>}>
        {staffUpload && <LoadError error={docs.error} what="your documents" onRetry={docs.reload} />}
        {docs.data && docs.data.length === 0 && <EmptyState icon="file-text" title="No documents sent yet" sub="Use the form above to send your first one." />}
        {docs.data && docs.data.length > 0 && (() => {
          const { current, history } = documentCards(docs.data, today);
          return (
            <>
              <div className={rx['module-booking-list']}>
                {current.map(c => (
                  <ModuleRow key={c.submission.submissionId} avatar={c.submission.docType.charAt(0)} tone={c.dateState === 'current' ? 'teal' : c.dateState === 'expiring' ? 'gold' : 'slate'}
                    title={c.submission.docType}
                    sub={c.review === 'uploading' ? 'Uploading…'
                      : c.review === 'received' && c.submission.verified ? 'Verified by Flavors.'
                      : c.review === 'received' && c.submission.fromRecord ? 'On file with Flavors. Waiting for verification.'
                      : c.review === 'received' ? 'Uploaded. Waiting for Flavors to verify it.'
                      : c.review === 'not-accepted' ? (c.reviewNote || 'Not accepted. Please send it again.')
                      : 'Being processed.'}
                    time={`${c.dateState === 'expired' ? 'Expired' : 'Expires'} ${formatDate(c.submission.expiryDate)}`}
                    status={c.dateState === 'current' ? 'Current' : c.dateState === 'expiring' ? 'Expiring soon' : 'Expired'} statusTone={c.dateState === 'current' ? 'ok' : c.dateState === 'expiring' ? 'wait' : 'bad'}
                    extra={c.dateState === 'expired' ? <span>You cannot book until a current one is on file. Send a renewal above.</span> : undefined} />
                ))}
              </div>
              {history.length > 0 && (
                <details className={styles.history} style={{ marginTop: 14 }}>
                  <summary>Earlier uploads ({history.length})</summary>
                  <div className={rx['module-booking-list']} style={{ marginTop: 10 }}>
                    {history.map(d => <ModuleRow key={d.submissionId} avatar={d.docType.charAt(0)} tone="slate" title={d.docType} sub={`Issued ${formatDate(d.issueDate)} · expired or replaced ${formatDate(d.expiryDate)}`} />)}
                  </div>
                </details>
              )}
            </>
          );
        })()}
      </ModuleCard>

      {!staffUpload && docs.data && flags.data && (
        <details className={s.dcGuide}>
          <summary>Step-by-step compliance check</summary>
          <ComplianceWizard source={source} docs={docs.data} flags={flags.data} required={required.data || []} today={today} onSent={() => { docs.reload(); flags.reload(); }} />
        </details>
      )}
    </div>
  );
}

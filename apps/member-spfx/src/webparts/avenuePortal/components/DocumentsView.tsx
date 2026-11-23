import * as React from 'react';
import { DefaultButton, Dropdown, type IDropdownOption, MessageBar, MessageBarType, PrimaryButton, Spinner } from '@fluentui/react';
import styles from './AvenuePortal.module.scss';
import { ALLOWED_EXTENSIONS, validateDocument } from '../../../avenue/documents';
import { DOC_TYPES, type DocType, type IMyDocumentSubmission } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { documentCards } from '../../../avenue/home';
import ComplianceWizard from './ComplianceWizard';
import s from './Site.module.scss';
import { flagState, hasHold, onboarding } from '../../../avenue/compliance';
import type { IMyMembership } from '../../../avenue/contracts';
import type { IMyFlag } from '../../../avenue/contracts';
import { Empty, ErrorBar, formatDate, Section, useLoad } from './ui';

export interface IDocumentsViewProps {
  source: AvenueReadSource;
  /** The facility's time zone, so "expired today" matches Home and the flows. */
  timeZone: string;
  /** Staff page only (see the web part setting). */
  staffUpload?: boolean;
  /** The signed-in member, for the onboarding checklist. */
  userEmail?: string;
}

const TYPE_OPTIONS: IDropdownOption[] = DOC_TYPES.map(t => ({ key: t, text: t }));

// Permits, licences, insurance and certifications (CMP-01). Files go to the member's own submission and are copied by
// a flow into a private library only Flavors can read. Expired documents block new bookings unless the owner overrides.
export default function DocumentsView(props: IDocumentsViewProps): React.ReactElement {
  const { source, timeZone, staffUpload } = props;
  const userEmail: string = props.userEmail || '';
  const flags = useLoad<IMyFlag[]>(() => source.listMyFlags().catch((): IMyFlag[] => []), [source]);
  const required = useLoad<DocType[]>(() => source.listRequiredDocTypes().catch((): DocType[] => []), [source]);
  const membership = useLoad<IMyMembership | undefined>(() => source.getMyMembership(userEmail).catch(() => undefined), [source, userEmail]);
  const [forMember, setForMember] = React.useState<string>('');
  const docs = useLoad<IMyDocumentSubmission[]>(() => source.listMyDocuments(), [source]);
  const [docType, setDocType] = React.useState<DocType | undefined>();
  const [issueDate, setIssueDate] = React.useState<string>('');
  const [expiryDate, setExpiryDate] = React.useState<string>('');
  const [file, setFile] = React.useState<File | undefined>();
  const [errors, setErrors] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState<boolean>(false);
  const [sent, setSent] = React.useState<boolean>(false);
  const fileInput: React.RefObject<HTMLInputElement> = React.useRef<HTMLInputElement>(null);

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
        setDocType(undefined);
        setIssueDate('');
        setExpiryDate('');
        setFile(undefined);
        if (fileInput.current) {
          fileInput.current.value = '';
        }
        docs.reload();
      })
      .catch((err: Error) => setErrors([err.message]))
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
      {!staffUpload && docs.data && flags.data && <ComplianceWizard source={source} docs={docs.data} flags={flags.data} required={required.data || []} today={today} onSent={() => { docs.reload(); flags.reload(); }} />}
      <Section title="Send a document" description="Permits, licences, insurance and certifications. Flavors checks each one.">
        {sent && <MessageBar messageBarType={MessageBarType.success} onDismiss={() => setSent(false)}>Document sent. Its status appears below within a minute or two.</MessageBar>}
        <form onSubmit={submit} noValidate aria-label="Send a document">
          <div className={styles.form}>
            {staffUpload && (
              <div className={styles.formWide}>
                <label className={styles.fieldLabel} htmlFor="avenue-doc-for">For member (their sign-in e-mail; leave empty for yourself)</label>
                <input id="avenue-doc-for" className={styles.nativeInput} type="email" value={forMember} onChange={e => setForMember(e.target.value)} />
              </div>
            )}
            <Dropdown label="Type" placeholder="Choose a type" selectedKey={docType || null} options={TYPE_OPTIONS} onChange={(_, o) => setDocType(o ? (o.key as DocType) : undefined)} required />
            <div>
              <label className={styles.fieldLabel} htmlFor="avenue-doc-issue">Issue date</label>
              <input id="avenue-doc-issue" className={styles.nativeInput} type="date" value={issueDate} max={today} onChange={e => setIssueDate(e.target.value)} required />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="avenue-doc-expiry">Expiry date</label>
              <input id="avenue-doc-expiry" className={styles.nativeInput} type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
            </div>
            <div className={styles.formWide}>
              <label className={styles.fieldLabel} htmlFor="avenue-doc-file">File (PDF, JPEG or PNG, up to 10 MB)</label>
              <input
                id="avenue-doc-file"
                ref={fileInput}
                className={styles.nativeInput}
                type="file"
                accept={ALLOWED_EXTENSIONS.map(x => `.${x}`).join(',')}
                onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)}
                required
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}><ErrorBar error={errors.length ? errors.join(' ') : undefined} onDismiss={() => setErrors([])} /></div>
          <p><PrimaryButton type="submit" text={sending ? 'Sending…' : 'Send document'} disabled={sending} /></p>
        </form>
      </Section>

      <section aria-label="My documents">
        <div className={styles.docHead}>
          <h2 className={styles.sectionLabel}>My documents</h2>
          <DefaultButton text="Refresh" onClick={docs.reload} />
        </div>
        <ErrorBar error={docs.error ? `Could not load your documents. ${docs.error}` : undefined} />
        {!docs.data && !docs.error && <Spinner label="Loading your documents" />}
        {docs.data && docs.data.length === 0 && <Empty>You have not sent any documents yet. Use the form above to send your first one.</Empty>}
        {docs.data && docs.data.length > 0 && (() => {
          const { current, history } = documentCards(docs.data, today);
          return (
            <>
              <ul className={styles.docCards}>
                {current.map(c => (
                  <li key={c.submission.submissionId} className={`${styles.docCard} ${c.dateState === 'expired' ? styles.docExpired : ''}`}>
                    <div className={styles.docTop}>
                      <strong>{c.submission.docType}</strong>
                      <span className={`${styles.statusPill} ${c.dateState === 'current' ? styles.statusOk : c.dateState === 'expiring' ? styles.statusWaiting : styles.statusBad}`}>
                        {c.dateState === 'current' ? 'Current' : c.dateState === 'expiring' ? 'Expiring soon' : 'Expired'}
                      </span>
                    </div>
                    <span className={styles.docDate}>{c.dateState === 'expired' ? 'Expired' : 'Expires'} {formatDate(c.submission.expiryDate)}</span>
                    <span className={c.review === 'not-accepted' ? styles.error : styles.muted}>
                      {c.review === 'uploading' ? 'Uploading…'
                        : c.review === 'received' ? 'Uploaded. Waiting for Flavors to verify it.'
                        : c.review === 'not-accepted' ? (c.reviewNote || 'Not accepted. Please send it again.')
                        : 'Being processed. This usually takes a minute or two.'}
                    </span>
                    {c.dateState === 'expired' && <span className={styles.muted}>You cannot book until a current one is on file. Send a renewal above.</span>}
                  </li>
                ))}
              </ul>
              {history.length > 0 && (
                <details className={styles.history}>
                  <summary>Earlier uploads ({history.length})</summary>
                  <ul className={styles.list}>
                    {history.map(d => (
                      <li key={d.submissionId}>
                        <div className={styles.rowMain}>
                          <span className={styles.rowTitle}>{d.docType}</span>
                          <span className={styles.rowMeta}>Issued {formatDate(d.issueDate)} · expired or replaced {formatDate(d.expiryDate)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
}

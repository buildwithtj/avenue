import * as React from 'react';
import s from './Site.module.scss';
import { ALLOWED_EXTENSIONS, validateDocument } from '../../../avenue/documents';
import { CATEGORIES, categoryProgress, flagState, itemState, wizardSteps } from '../../../avenue/compliance';
import { FLAG_REASONS, type FlagReason, type IMyDocumentSubmission, type IMyFlag } from '../../../avenue/contracts';
import { newestPerType } from '../../../avenue/home';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { formatDate } from './ui';
import { useReducedMotion } from './motion';

export interface IComplianceWizardProps {
  source: AvenueReadSource;
  docs: IMyDocumentSubmission[];
  flags: IMyFlag[];
  /** Document types Flavors requires; marked on the question. */
  required?: string[];
  today: string;
  /** Called after a document was sent so the list below reloads. */
  onSent: () => void;
}

// One question at a time, grouped by category, with a slide between questions (CMP-01). Sends the same intake item as the
// plain form below it, so nothing new is trusted: the flow still re-validates and Flavors still verifies.
export default function ComplianceWizard(props: IComplianceWizardProps): React.ReactElement {
  const { source, docs, flags, today, onSent } = props;
  const required: string[] = props.required || [];
  const reduced: boolean = useReducedMotion();
  const steps = React.useMemo(() => wizardSteps(), []);
  const total: number = steps.length;
  const [i, setI] = React.useState<number>(0);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [open, setOpen] = React.useState<boolean>(false); // "Yes, upload" panel
  const [flagging, setFlagging] = React.useState<boolean>(false);
  const [reason, setReason] = React.useState<FlagReason | ''>('');
  const [fnote, setFnote] = React.useState<string>('');
  const [issue, setIssue] = React.useState<string>('');
  const [expiry, setExpiry] = React.useState<string>('');
  const [file, setFile] = React.useState<File | undefined>();
  const [err, setErr] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [sentTypes, setSentTypes] = React.useState<string[]>([]);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); } }, []);

  const reset = (): void => { setFlagging(false); setReason(''); setFnote(''); setOpen(false); setIssue(''); setExpiry(''); setFile(undefined); setErr(''); };
  const go = (n: number): void => { setDir(n >= i ? 1 : -1); setI(Math.max(0, Math.min(total, n))); reset(); };

  const done: boolean = i >= total;
  const step = done ? undefined : steps[i];
  const state = step ? itemState(step.item.type, docs, today) : 'current';
  const have: IMyDocumentSubmission | undefined = step ? newestPerType(docs).get(step.item.type) : undefined;
  const justSent: boolean = !!step && sentTypes.indexOf(step.item.type) >= 0;
  const justFlagged: boolean = !!step && sentTypes.indexOf('flag:' + step.item.type) >= 0;
  const prog = categoryProgress(docs, today);

  const myFlag: IMyFlag | undefined = step ? flags.filter(f => f.docType === step.item.type)[0] : undefined;
  const fState = myFlag ? flagState(myFlag.outcome) : undefined;
  const sendFlag = (): void => {
    if (!step || busy) { return; }
    const input = { facilityId: source.facilityId, docType: step.item.type, reason: reason || undefined, note: fnote };
    source.submitFlag(input, newSubmissionId('flag'))
      .then(() => { setSentTypes(t => t.concat('flag:' + step.item.type)); setBusy(false); onSent(); timer.current = window.setTimeout(() => go(i + 1), 1100); })
      .catch((e: Error) => { setBusy(false); setErr(e.message); });
    setBusy(true); setErr('');
  };
  const send = (): void => {
    if (!step || busy) { return; }
    const input = { facilityId: source.facilityId, docType: step.item.type, issueDate: issue, expiryDate: expiry, file: file ? { name: file.name, size: file.size } : undefined };
    const problems: string[] = validateDocument(input);
    if (problems.length > 0 || !file) { setErr(problems.join(' ')); return; }
    setBusy(true); setErr('');
    source.submitDocument(input, file, newSubmissionId('doc'))
      .then(() => {
        setSentTypes(t => t.concat(step.item.type));
        setBusy(false);
        onSent();
        timer.current = window.setTimeout(() => go(i + 1), 900);
      })
      .catch((e: Error) => { setBusy(false); setErr(e.message); });
  };

  const animCls: string = reduced ? '' : dir === 1 ? s.cwInFwd : s.cwInBack;
  return (
    <section className={s.cw} aria-label="Compliance check">
      <header className={s.cwHead}>
        <div>
          <h2>Compliance check</h2>
          <p>{done ? 'All questions answered.' : `Question ${i + 1} of ${total}`}</p>
        </div>
        <div className={s.cwBar} aria-hidden="true"><span style={{ width: `${Math.round((Math.min(i, total) / total) * 100)}%` }} /></div>
      </header>

      <nav className={s.cwCats} aria-label="Categories">
        {CATEGORIES.map(c => {
          const first: number = steps.findIndex(x => x.cat.key === c.key);
          const p = prog.filter(x => x.key === c.key)[0];
          const active: boolean = !!step && step.cat.key === c.key;
          return (
            <button key={c.key} type="button" className={`${s.cwCat} ${active ? s.cwCatOn : ''}`} aria-current={active ? 'step' : undefined} onClick={() => go(first)}>
              <strong>{c.title}</strong>
              <span>{p.done} of {p.total} on file</span>
            </button>
          );
        })}
      </nav>

      <div className={s.cwStage}>
        <div key={i} className={`${s.cwCard} ${animCls}`} aria-live="polite">
          {step && (
            <>
              <span className={s.cwEyebrow}>{step.cat.title}{required.indexOf(step.item.type) >= 0 ? ' · Required' : ''}</span>
              <h3>{step.item.question}</h3>
              <p className={s.cwHelp}>{step.item.help}</p>

              {justSent && <p className={s.cwOk} role="status">Sent. Flavors will verify it.</p>}
              {justFlagged && <p className={s.cwOk} role="status">Sent to Flavors. You will see their answer here and on your Documents page.</p>}
              {!justFlagged && fState && fState.state !== 'released' && fState.state !== 'cleared' && (
                <p className={`${s.cwOn} ${s.cwWarn}`} role="status">Flagged: {myFlag ? myFlag.reason : ''}. {fState.text}</p>
              )}
              {!justSent && have && (
                <p className={`${s.cwOn} ${state === 'current' ? '' : s.cwWarn}`}>
                  {state === 'current' ? 'On file' : state === 'expiring' ? 'On file, expiring soon' : 'On file, expired'}: expires {formatDate(have.expiryDate)}
                </p>
              )}

              {!justSent && !justFlagged && !open && !flagging && (
                <div className={s.cwActions}>
                  <button type="button" className={s.cwYes} onClick={() => setOpen(true)}>{have ? 'Upload a new one' : 'Yes, upload it'}</button>
                  <button type="button" className={s.cwSkip} onClick={() => go(i + 1)}>{state === 'current' ? 'Keep this one' : 'Not yet, skip'}</button>
                  <button type="button" className={s.cwFlag} onClick={() => setFlagging(true)}>Something is not right</button>
                </div>
              )}
              {!justFlagged && flagging && (
                <div className={s.cwForm}>
                  <label className={s.cwWide}>What is not right?
                    <select value={reason} onChange={e => setReason(e.target.value as FlagReason | '')}>
                      <option value="">Choose one</option>
                      {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className={s.cwWide}>Tell staff more (optional)
                    <textarea rows={3} maxLength={1000} value={fnote} onChange={e => setFnote(e.target.value)} />
                  </label>
                  <p className={s.cwHelp}>Flavors reviews this. If they place a hold, new bookings pause until it is resolved.</p>
                  {err && <p className={s.cwErr} role="alert">{err}</p>}
                  <div className={s.cwActions}>
                    <button type="button" className={s.cwYes} disabled={busy} onClick={sendFlag}>{busy ? 'Sending…' : 'Send to Flavors'}</button>
                    <button type="button" className={s.cwSkip} onClick={reset}>Back</button>
                  </div>
                </div>
              )}

              {!justSent && open && (
                <div className={s.cwForm}>
                  <label>Issued on<input type="date" value={issue} max={today} onChange={e => setIssue(e.target.value)} /></label>
                  <label>Expires on<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
                  <label className={s.cwWide}>File (PDF, JPEG or PNG, up to 10 MB)
                    <input type="file" accept={ALLOWED_EXTENSIONS.map(x => `.${x}`).join(',')} onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} />
                  </label>
                  {err && <p className={s.cwErr} role="alert">{err}</p>}
                  <div className={s.cwActions}>
                    <button type="button" className={s.cwYes} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
                    <button type="button" className={s.cwSkip} onClick={reset}>Back</button>
                  </div>
                </div>
              )}
            </>
          )}
          {done && (
            <>
              <span className={s.cwEyebrow}>Summary</span>
              <h3>{prog.every(p => p.needs === 0) ? 'You are fully compliant.' : 'A few documents still need attention.'}</h3>
              <ul className={s.cwSum}>
                {CATEGORIES.map(c => (
                  <li key={c.key}>
                    <strong>{c.title}</strong>
                    {c.items.map(it => {
                      const st = itemState(it.type, docs, today);
                      return <span key={it.type} className={st === 'current' ? s.cwSumOk : s.cwSumNo}>{it.type}: {st === 'missing' ? 'not sent' : st === 'current' ? 'current' : st}</span>;
                    })}
                  </li>
                ))}
              </ul>
              <div className={s.cwActions}><button type="button" className={s.cwSkip} onClick={() => go(0)}>Start again</button></div>
            </>
          )}
        </div>
      </div>

      {step && (
        <footer className={s.cwNav}>
          <button type="button" className={s.cwSkip} disabled={i === 0} onClick={() => go(i - 1)}>Previous</button>
          <button type="button" className={s.cwSkip} onClick={() => go(i + 1)}>{i === total - 1 ? 'Finish' : 'Next'}</button>
        </footer>
      )}
    </section>
  );
}

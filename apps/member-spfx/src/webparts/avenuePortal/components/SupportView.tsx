import * as React from 'react';
import s from './Site.module.scss';
import { SUPPORT_CATEGORIES, type IMySupportMessage, type SupportCategory } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { groupThreads, validateSupport, type IThread, type ISupportInput } from '../../../avenue/support';
import { toast } from './feedback';
import { Empty, RequestStatus, useLoad, LoadError } from './ui';

export interface ISupportViewProps { source: AvenueReadSource; facilityId: string }

// Messages with Flavors. The member writes intake items only; Flavors' reply is echoed onto the member's own item. No reply time is promised (Q-13).
export default function SupportView(props: ISupportViewProps): React.ReactElement {
  const { source, facilityId } = props;
  const data = useLoad<IMySupportMessage[]>(() => source.listMySupportMessages(), [source]);
  const [open, setOpen] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const threads: IThread[] = React.useMemo(() => groupThreads(data.data || []), [data.data]);
  const current: IThread | undefined = threads.filter(t => t.threadId === open)[0];

  const send = (input: ISupportInput, threadId?: string): void => {
    setBusy(true); setError(undefined);
    source.submitSupportMessage(input, newSubmissionId('msg'), threadId)
      .then(() => { toast('Message sent to Flavors.'); setBusy(false); data.reload(); setOpen(threadId); })
      .catch((e: Error) => { setError(e.message); setBusy(false); });
  };

  return (
    <section className={s.nm} aria-label="Messages with Flavors">
      <header className={s.nmHead}>
        <div><h2>Messages with Flavors</h2><p className={s.cwHelp}>Ask a question or report a problem. Flavors replies here, in Avenue.</p></div>
        {open === undefined && <button type="button" className={s.cwYes} onClick={() => { setOpen('new'); setError(undefined); }}>New message</button>}
        {open !== undefined && <button type="button" className={s.cwSkip} onClick={() => { setOpen(undefined); setError(undefined); }}>← All messages</button>}
      </header>
      <LoadError error={data.error} what="your conversations" onRetry={data.reload} />
      {open === 'new' && <Composer key="new" facilityId={facilityId} busy={busy} error={error} onSend={i => send(i)} />}
      {current && (
        <div className={s.nmThread}>
          <h3>{current.subject}</h3>
          <ol className={s.nmMsgs}>
            {current.messages.map(m => (
              <li key={m.id}>
                <div className={s.nmMine}><small>You · {m.category}</small><p>{m.body}</p></div>
                <RequestStatus outcome={m.outcome} reply={m.reply} />
              </li>
            ))}
          </ol>
          <Composer key={current.threadId + current.messages.length} facilityId={facilityId} busy={busy} error={error} thread={current} onSend={i => send(i, current.threadId)} />
        </div>
      )}
      {open === undefined && (data.loading && !data.data ? <p role="status">Loading your messages…</p> : threads.length === 0 ? <Empty>No messages yet. Use New message to write to Flavors.</Empty> : (
        <ul className={s.nmList}>
          {threads.map(t => (
            <li key={t.threadId}>
              <button type="button" className={s.nmCard} onClick={() => { setOpen(t.threadId); setError(undefined); }}>
                <span><strong>{t.subject}</strong><small>{t.category} · {t.messages.length} {t.messages.length === 1 ? 'message' : 'messages'}</small></span>
                {t.replyReceived ? <b className={s.nmDot}>Reply received</b> : <small>{t.last.outcome || 'Sent'}</small>}
              </button>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}

function Composer(props: { facilityId: string; busy: boolean; error?: string; thread?: IThread; onSend: (i: ISupportInput) => void }): React.ReactElement {
  const t: IThread | undefined = props.thread;
  const [category, setCategory] = React.useState<SupportCategory | ''>(t ? t.category : '');
  const [subject, setSubject] = React.useState<string>(t ? `Re: ${t.subject}`.slice(0, 120) : '');
  const [body, setBody] = React.useState<string>('');
  const [local, setLocal] = React.useState<string | undefined>();
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const input: ISupportInput = { facilityId: props.facilityId, category, subject, body };
    const errors: string[] = validateSupport(input);
    if (errors.length > 0) { setLocal(errors.join(' ')); return; }
    setLocal(undefined); props.onSend(input);
  };
  return (
    <form className={s.nmForm} onSubmit={submit}>
      {!t && (
        <>
          <label>About<select value={category} onChange={e => setCategory(e.target.value as SupportCategory | '')}><option value="">Choose…</option>{SUPPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label>Subject<input value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} /></label>
        </>
      )}
      <label>{t ? 'Reply' : 'Message'}<textarea rows={4} value={body} maxLength={2000} onChange={e => setBody(e.target.value)} /></label>
      {(local || props.error) && <p className={s.cwErr} role="alert">{local || props.error}</p>}
      <div className={s.cwActions}><button type="submit" className={s.cwYes} disabled={props.busy}>{props.busy ? 'Sending…' : 'Send'}</button></div>
    </form>
  );
}

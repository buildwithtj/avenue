import * as React from 'react';
import { createPortal } from 'react-dom';
import s from './Site.module.scss';
import { SUPPORT_CATEGORIES, type IMySupportMessage } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { ATTACH_ACCEPT, SUPPORT_ATTACHMENTS_ENABLED, groupThreads, MAX_ATTACHMENTS, threadStatus, validateAttachments, validateSupport, type IThread, type ISupportInput, type ThreadStatus } from '../../../avenue/support';
import { toast } from './feedback';
import { useSize } from './motion';
import { RefIcon } from './RefUi';
import { useLoad, LoadError } from './ui';

export interface ISupportViewProps { source: AvenueReadSource; facilityId: string }

type Picked = Blob & { name: string; size: number };
type Screen = 'list' | 'topic' | 'subject' | 'chat';

const STATUS_LABEL: Record<ThreadStatus, string> = { Open: 'Open', Answered: 'Answered', Closed: 'Closed', Archived: 'Archived', Uploading: 'Not sent' };
const TOPIC_ICON: Record<string, string> = { Booking: 'calendar-days', Billing: 'credit-card', Documents: 'file-text', Equipment: 'cooking-pot', Other: 'message-square' };
const topicIcon = (c: string): string => TOPIC_ICON[c] || 'sparkles';
const topicLabel = (c: string): string => (c === 'Other' ? 'General' : c);
/** Suggested subjects per topic: shortcuts for the subject field only; the member can write anything. */
const SUGGEST: Record<string, string[]> = {
  Booking: ['Change or cancel a booking', 'Question about my booking times', 'Equipment is not available'],
  Billing: ['Question about an invoice', 'Update my payment method', 'Extra hours on my bill'],
  Documents: ['Upload or renew a document', 'Is my document accepted?', 'A document shows as expired'],
  Equipment: ['Something is broken or missing', 'Cleaning or supplies', 'Question about an appliance'],
  Other: ['General question', 'Access or door code', 'Something else']
};
const suggestions = (c: string): string[] => SUGGEST[c] || ['Question', 'A problem to report', 'A request'];

/** Thumbnails only for formats every browser draws; HEIC and PDF show as a file chip. */
const drawable = (name: string): boolean => /\.(jpe?g|png|webp)$/i.test(name);
const kb = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dayKey = (iso: string): string => { const d: Date = new Date(iso); return isNaN(d.getTime()) ? '' : d.toDateString(); };
const dayLabel = (iso: string): string => {
  const d: Date = new Date(iso); const t: Date = new Date(); const y: Date = new Date(Date.now() - 86400000);
  return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const clock = (iso: string): string => { const d: Date = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };

/** A 3D circular icon (the shared icon primitive) used for conversations and topic tiles. */
function Ico(props: { name: string; size?: 'lg' | 'md' | 'sm'; tone?: string }): React.ReactElement {
  return <span className={`${s.ico3d} ${props.size === 'lg' ? s.ico44 : props.size === 'sm' ? s.ico32 : s.ico40}`} data-tone={props.tone || 'teal'} aria-hidden="true"><RefIcon name={props.name} size={props.size === 'lg' ? 22 : 19} /></span>;
}

// Messages with Flavors as a messaging console: conversation list, a new-message flow (topic, subject) and a chat.
// The member writes intake items only; Flavors' reply is echoed onto the member's own items (AvenueSupportMessages). Unchanged logic:
// validation (validateSupport / validateAttachments), the intake item and thread grouping live in avenue/support.ts. No reply time is promised (Q-13).
export default function SupportView(props: ISupportViewProps): React.ReactElement {
  const { source, facilityId } = props;
  const size = useSize();
  const phone: boolean = size === 'phone';
  const data = useLoad<IMySupportMessage[]>(() => source.listMySupportMessages(), [source]);
  const cats = useLoad<string[]>(() => (typeof source.listSupportCategories === 'function' ? source.listSupportCategories() : Promise.resolve(SUPPORT_CATEGORIES.slice())), [source]);
  const categories: string[] = cats.data || SUPPORT_CATEGORIES;
  const [screen, setScreen] = React.useState<Screen>('list');
  const [dir, setDir] = React.useState<'fwd' | 'back'>('fwd');
  const [openId, setOpenId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState<{ category: string; subject: string } | undefined>();
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState<{ key: string; body: string; names: string[] }[]>([]);
  const waiting = React.useRef<boolean>(false);
  const threads: IThread[] = React.useMemo(() => groupThreads(data.data || []), [data.data]);
  const current: IThread | undefined = threads.filter(t => t.threadId === openId)[0];
  const host = React.useRef<HTMLElement | null>(null);
  const [root, setRoot] = React.useState<HTMLElement | undefined>();
  React.useLayoutEffect(() => { const r: Element | null = host.current ? host.current.closest('[data-size]') : null; setRoot(r ? (r as HTMLElement) : undefined); }, []);

  const go = (to: Screen, d: 'fwd' | 'back'): void => { setDir(d); setScreen(to); setError(undefined); };
  // A sent message re-reads the list; when it arrives the optimistic bubble is replaced, and a brand-new conversation opens on its real thread.
  React.useEffect(() => {
    if (!waiting.current) { return; }
    waiting.current = false;
    setPending([]);
    if (draft) { const t: IThread | undefined = groupThreads(data.data || [])[0]; if (t) { setOpenId(t.threadId); setDraft(undefined); } }
  }, [data.data]);

  const send = (body: string, files: Picked[]): boolean => {
    const base = current ? { category: current.category, subject: `Re: ${current.subject}`.slice(0, 120) } : draft;
    if (!base) { return false; }
    const input: ISupportInput = { facilityId, category: base.category, subject: base.subject, body };
    const errors: string[] = validateSupport(input, current ? [current.category] : categories).concat(validateAttachments(files));
    if (errors.length > 0) { setError(errors.join(' ')); return false; }
    setBusy(true); setError(undefined);
    setPending(p => p.concat({ key: newSubmissionId('p'), body, names: files.map(f => f.name) }));
    source.submitSupportMessage(input, newSubmissionId('msg'), current ? current.threadId : undefined, files, categories)
      .then(() => { toast('Message sent to Flavors.'); setBusy(false); waiting.current = true; data.reload(); })
      .catch((e: Error) => { setPending([]); setBusy(false); setError(files.length ? `${e.message} Your message was not sent with its files. Try again.` : e.message); });
    return true;
  };

  const listPane: React.ReactElement = (
    <div className={s.msgList}>
      <div className={s.msgHeadRow}>
        <p className={s.msgCount}>{threads.length > 0 ? `${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'} with Flavors` : ''}</p>
        <button type="button" className={s.msgNew} onClick={() => { setDraft(undefined); setOpenId(undefined); go('topic', 'fwd'); }}><RefIcon name="message-square" size={18} /><span>New message</span></button>
      </div>
      <LoadError error={data.error} what="your conversations" onRetry={data.reload} />
      {data.loading && !data.data ? <div className={s.msgSkel} role="status" aria-label="Loading your messages"><i /><i /><i /></div> : threads.length === 0 ? (
        <div className={s.msgEmpty} role="status"><Ico name="message-square" size="lg" /><b>No messages yet</b><p>Use New message to write to Flavors. Replies appear here.</p></div>
      ) : (
        <ul className={s.msgRows}>
          {threads.map((t, i) => {
            const st: ThreadStatus = threadStatus(t);
            const preview: string = ((t.last.reply || '').trim() || t.last.body || '').replace(/\s+/g, ' ');
            return (
              <li key={t.threadId} style={{ ['--i' as string]: Math.min(i, 8) } as React.CSSProperties}>
                <button type="button" className={`${s.msgRow} ${t.threadId === openId && screen === 'chat' ? s.msgRowOn : ''}`} data-status={st} onClick={() => { setOpenId(t.threadId); setDraft(undefined); go('chat', 'fwd'); }}>
                  <Ico name={topicIcon(t.category)} size="lg" tone={st === 'Answered' ? 'teal' : st === 'Open' ? 'gold' : 'slate'} />
                  <span className={s.msgRowText}><strong>{t.subject}</strong><small>{(t.replyReceived ? 'Flavors: ' : 'You: ') + preview}</small></span>
                  <span className={s.msgRowMeta}><em className={`${s.msgChip} ${st === 'Answered' ? s.msgChipOk : st === 'Open' ? s.msgChipWait : ''}`}>{STATUS_LABEL[st]}</em>{st === 'Answered' && <i className={s.msgDot} aria-label="Reply received" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const topicPane: React.ReactElement = (
    <div className={`${s.msgStep} ${s.pane}`} data-dir={dir}>
      <header className={s.msgStepHead}><button type="button" className={s.msgBack} aria-label="Back to messages" onClick={() => go('list', 'back')}><RefIcon name="chevron-left" size={20} /></button><div><small>Step 1 of 2</small><h2>What is it about?</h2></div></header>
      <ul className={s.msgTopics}>
        {categories.map((c, i) => (
          <li key={c} style={{ ['--i' as string]: i } as React.CSSProperties}>
            <button type="button" className={s.msgTopic} onClick={() => { setDraft({ category: c, subject: '' }); go('subject', 'fwd'); }}>
              <Ico name={topicIcon(c)} size="lg" tone={c === 'Billing' ? 'sky' : c === 'Documents' ? 'rose' : c === 'Equipment' ? 'gold' : c === 'Other' ? 'slate' : 'teal'} />
              <strong>{topicLabel(c)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const [subject, setSubject] = React.useState<string>('');
  React.useEffect(() => { if (screen === 'subject') { setSubject(draft ? draft.subject : ''); } }, [screen]);
  const subjectOk: boolean = subject.trim().length >= 3 && subject.trim().length <= 120;
  const subjectPane: React.ReactElement = (
    <div className={`${s.msgStep} ${s.pane}`} data-dir={dir}>
      <header className={s.msgStepHead}><button type="button" className={s.msgBack} aria-label="Back to topics" onClick={() => go('topic', 'back')}><RefIcon name="chevron-left" size={20} /></button><div><small>Step 2 of 2 · {draft ? topicLabel(draft.category) : ''}</small><h2>What is the subject?</h2></div></header>
      <div className={s.msgChips} role="group" aria-label="Suggested subjects">
        {draft && suggestions(draft.category).map(t => <button key={t} type="button" aria-pressed={subject === t} className={subject === t ? s.msgChipOn : ''} onClick={() => setSubject(t)}>{t}</button>)}
      </div>
      <label className={s.msgSubject}><span>Subject</span><input value={subject} maxLength={120} placeholder="Or write your own" onChange={e => setSubject(e.target.value)} /></label>
      {error && <p className={s.cwErr} role="alert">{error}</p>}
      <button type="button" className={`${s.btn} ${s.btnCitrus} ${s.msgGo}`} disabled={!subjectOk} onClick={() => { if (draft) { setDraft({ ...draft, subject: subject.trim() }); go('chat', 'fwd'); } }}>Start chat<RefIcon name="chevron-right" size={16} /></button>
    </div>
  );

  const chatTopic: string = current ? current.category : draft ? draft.category : '';
  const chat: React.ReactElement | undefined = (current || draft) ? (
    <Chat key={current ? current.threadId : 'draft'} thread={current} draftSubject={draft ? draft.subject : undefined} topic={chatTopic} pending={pending} busy={busy} error={error} dir={dir} onBack={() => { go('list', 'back'); setOpenId(undefined); setDraft(undefined); }} onSend={send} phone={phone} />
  ) : undefined;
  const chatNode: React.ReactNode = chat && phone ? createPortal(chat, root || document.body) : chat;

  const right: React.ReactNode = screen === 'topic' ? topicPane : screen === 'subject' ? subjectPane : screen === 'chat' ? chatNode
    : <div className={s.msgHint}><Ico name="message-square" size="lg" /><b>Select a conversation</b></div>;

  return (
    <section className={s.msg} aria-label="Messages with Flavors" ref={el => { host.current = el; }} data-phone={phone ? '1' : undefined}>
      {phone
        ? (screen === 'list' ? listPane : screen === 'chat' ? <>{listPane}{right}</> : right)
        : threads.length === 0 && screen === 'list' ? <div className={s.msgSolo}>{listPane}</div>
        : <div className={s.msgShell}>{listPane}<div className={s.msgRight}>{right}</div></div>}
    </section>
  );
}

function Files(props: { files?: { name: string; url: string }[] }): React.ReactElement {
  if (!props.files || props.files.length === 0) { return <></>; }
  return (
    <ul className={s.tkFiles} aria-label="Attachments">
      {props.files.map(f => (
        <li key={f.url}>
          <a className={s.tkFile} href={f.url} target="_blank" rel="noopener noreferrer">
            {drawable(f.name) ? <img src={f.url} alt="" loading="lazy" /> : <span aria-hidden="true">{/\.pdf$/i.test(f.name) ? 'PDF' : 'File'}</span>}
            <em>{f.name}</em>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Delivery ticks from the echoed Outcome: clock = sending, one tick = received by the flow, two teal ticks = Flavors answered, ! = files did not finish. */
function Ticks(props: { state: 'sending' | 'sent' | 'answered' | 'failed' }): React.ReactElement {
  const { state } = props;
  return (
    <span className={s.msgTicks} data-state={state} role="img" aria-label={state === 'sending' ? 'Sending' : state === 'sent' ? 'Sent' : state === 'answered' ? 'Answered' : 'Not sent'}>
      <RefIcon name={state === 'sending' ? 'clock-3' : state === 'failed' ? 'circle-question-mark' : state === 'answered' ? 'check-check' : 'check'} size={14} />
    </span>
  );
}

/** One conversation as a chat: member bubbles on the right, Flavors on the left (a reply is shown once, after the first message that carries it). */
function Chat(props: { thread?: IThread; draftSubject?: string; topic: string; pending: { key: string; body: string; names: string[] }[]; busy: boolean; error?: string; dir: 'fwd' | 'back'; phone: boolean; onBack: () => void; onSend: (body: string, files: Picked[]) => boolean }): React.ReactElement {
  const t: IThread | undefined = props.thread;
  const st: ThreadStatus | undefined = t ? threadStatus(t) : undefined;
  const [body, setBody] = React.useState<string>('');
  const [files, setFiles] = React.useState<Picked[]>([]);
  const [local, setLocal] = React.useState<string | undefined>();
  const input = React.useRef<HTMLInputElement>(null);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const log = React.useRef<HTMLOListElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const previews: string[] = React.useMemo(() => files.map(f => (drawable(f.name) && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : '')), [files]);
  React.useEffect(() => () => { previews.forEach(u => { if (u) { URL.revokeObjectURL(u); } }); }, [previews]);
  // Latest message in view whenever the thread or the optimistic list changes.
  const count: number = (t ? t.messages.length : 0) + props.pending.length;
  React.useEffect(() => { const el: HTMLOListElement | null = log.current; if (el) { el.scrollTo ? el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) : (el.scrollTop = el.scrollHeight); } }, [count, props.error]);
  // Keyboard-safe (phone overlay): follow the visual viewport so the composer stays above the on-screen keyboard.
  React.useEffect(() => {
    const vv: VisualViewport | null | undefined = typeof window !== 'undefined' ? window.visualViewport : undefined;
    const el: HTMLDivElement | null = box.current;
    if (!vv || !el || !props.phone) { return undefined; }
    const fit = (): void => { el.style.height = `${Math.round(vv.height)}px`; el.style.transform = `translate3d(0, ${Math.round(vv.offsetTop)}px, 0)`; };
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, [props.phone]);
  // The text field grows with the message (1 to 5 lines).
  React.useEffect(() => { const a: HTMLTextAreaElement | null = area.current; if (a) { a.style.height = 'auto'; a.style.height = `${Math.min(a.scrollHeight, 120)}px`; } }, [body]);

  const pick = (list: FileList | null): void => {
    const next: Picked[] = files.concat(list ? Array.from(list) : []);
    const problems: string[] = validateAttachments(next);
    setLocal(problems.length ? problems.join(' ') : undefined);
    setFiles(next.filter(f => validateAttachments([f]).length === 0).slice(0, MAX_ATTACHMENTS));
    if (input.current) { input.current.value = ''; }
  };
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    setLocal(undefined);
    if (props.onSend(body, files)) { setBody(''); setFiles([]); }
  };
  let shown: string = '';
  let lastDay: string = '';
  const title: string = t ? t.subject : props.draftSubject || '';
  return (
    <div ref={box} className={`${s.msgChat} ${props.phone ? s.msgChatFull : ''} ${s.pane}`} data-dir={props.dir} role="region" aria-label={`Conversation: ${title}`}>
      <header className={s.msgChatHead}>
        <button type="button" className={s.msgBack} aria-label="Back to messages" onClick={props.onBack}><RefIcon name="chevron-left" size={20} /></button>
        <Ico name={topicIcon(props.topic)} size="lg" />
        <div className={s.msgChatTitle}><h2>{title}</h2><span><em className={s.msgChip}>{topicLabel(props.topic)}</em>{st && <em className={`${s.msgChip} ${st === 'Answered' ? s.msgChipOk : st === 'Open' ? s.msgChipWait : ''}`}>{STATUS_LABEL[st]}</em>}</span></div>
      </header>
      <ol ref={log} className={s.msgLog} aria-live="polite">
        {(!t || t.messages.length === 0) && props.pending.length === 0 && <li className={s.msgInfo}><RefIcon name="message-square" size={16} /><span>Write your first message below.</span></li>}
        {t && t.messages.map((m, n) => {
          const reply: string = (m.reply || '').trim();
          const fresh: boolean = !!reply && reply !== shown;
          if (fresh) { shown = reply; }
          const d: string = (m as IMySupportMessage & { created?: string }).created ? dayKey((m as IMySupportMessage & { created?: string }).created as string) : '';
          const sep: boolean = !!d && d !== lastDay; if (d) { lastDay = d; }
          const state: 'sent' | 'answered' | 'failed' = m.outcome === 'Uploading' ? 'failed' : reply ? 'answered' : 'sent';
          const created: string | undefined = (m as IMySupportMessage & { created?: string }).created;
          return (
            <React.Fragment key={m.id}>
              {sep && created && <li className={s.msgDay}><span>{dayLabel(created)}</span></li>}
              <li className={`${s.msgBubble} ${s.msgMine}`} style={{ ['--i' as string]: Math.min(n, 8) } as React.CSSProperties}>
                <p>{m.body}</p>
                <Files files={m.attachments} />
                <span className={s.msgFoot}>{created ? <time dateTime={created}>{clock(created)}</time> : null}<Ticks state={state} /></span>
                {m.outcome === 'Uploading' && <small className={s.tkWarn}>Files did not finish uploading, so Flavors has not received this message. Send it again.</small>}
                {n === (t ? t.messages.length - 1 : 0) && !reply && m.outcome && m.outcome !== 'Uploading' && <small className={s.msgOutcome}>{m.outcome}</small>}
              </li>
              {fresh && <li className={`${s.msgBubble} ${s.msgTheirs}`} style={{ ['--i' as string]: Math.min(n + 1, 8) } as React.CSSProperties}><strong>Reply from Flavors</strong><p>{reply}</p></li>}
            </React.Fragment>
          );
        })}
        {props.pending.map(p => (
          <li key={p.key} className={`${s.msgBubble} ${s.msgMine} ${s.msgSending}`}><p>{p.body}</p>{p.names.length > 0 && <small>{p.names.length} {p.names.length === 1 ? 'file' : 'files'}</small>}<span className={s.msgFoot}><Ticks state="sending" /></span></li>
        ))}
      </ol>
      {files.length > 0 && (
        <ul className={`${s.tkFiles} ${s.msgFiles}`} aria-label="Files to send">
          {files.map((f, n) => (
            <li key={`${f.name}-${n}`} className={s.tkFile}>
              {previews[n] ? <img src={previews[n]} alt="" /> : <span aria-hidden="true">{/\.pdf$/i.test(f.name) ? 'PDF' : 'File'}</span>}
              <em>{f.name} · {kb(f.size)}</em>
              <button type="button" className={s.tkRemove} aria-label={`Remove ${f.name}`} onClick={() => { setFiles(files.filter((_, i) => i !== n)); setLocal(undefined); }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {(local || props.error) && <p className={`${s.cwErr} ${s.msgErr}`} role="alert">{local || props.error}</p>}
      <form className={s.msgComposer} onSubmit={submit}>
        {SUPPORT_ATTACHMENTS_ENABLED && (
          <label className={s.msgAttach} aria-label="Attach photos or PDF" title={`Up to ${MAX_ATTACHMENTS} files, 10 MB each`}>
            <input ref={input} type="file" multiple accept={ATTACH_ACCEPT} onChange={e => pick(e.target.files)} disabled={files.length >= MAX_ATTACHMENTS} />
            <RefIcon name="paperclip" size={20} />
          </label>
        )}
        <label className={s.msgField}><span className={s.srOnly}>{t ? 'Reply' : 'Message'}</span>
          <textarea ref={area} rows={1} value={body} maxLength={2000} placeholder="Write a message" onChange={e => setBody(e.target.value)} />
        </label>
        <button type="submit" className={s.msgSend} disabled={props.busy} aria-label="Send"><RefIcon name="send" size={20} /></button>
      </form>
    </div>
  );
}

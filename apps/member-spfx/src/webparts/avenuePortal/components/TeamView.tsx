import * as React from 'react';
import s from './Site.module.scss';
import type { ITeamMember } from '../../../avenue/contracts';
import { type AvenueReadSource, newSubmissionId } from '../../../avenue/readSource';
import { validateTeamName } from '../../../avenue/team';
import { toast } from './feedback';
import rx from './Ref.module.scss';
import { ModuleCard } from './RefUi';
import { Empty, useLoad, LoadError } from './ui';

export interface ITeamViewProps { source: AvenueReadSource }

// The member's own team roster. It only prefills names in the wellness check; it grants no access to anything.
export default function TeamView(props: ITeamViewProps): React.ReactElement {
  const { source } = props;
  const data = useLoad<ITeamMember[]>(() => source.listMyTeam(), [source]);
  const team: ITeamMember[] = data.data || [];
  const [name, setName] = React.useState<string>('');
  const [role, setRole] = React.useState<'Lead' | 'Member'>('Member');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  const run = (p: Promise<void>, done: string): void => {
    setBusy(true); setError(undefined);
    p.then(() => { toast(done); setBusy(false); data.reload(); }).catch((e: Error) => { setError(e.message); setBusy(false); });
  };
  const add = (e: React.FormEvent): void => {
    e.preventDefault();
    const errors: string[] = validateTeamName(name, team);
    if (errors.length > 0) { setError(errors.join(' ')); return; }
    run(source.addTeamMember(name, role, newSubmissionId('team'), team).then(() => setName('')), 'Added to your team.');
  };

  const active: ITeamMember[] = team.filter(m => m.active);
  const gone: ITeamMember[] = team.filter(m => !m.active);
  return (
    <section className={s.nm} aria-label="My team">
      <ModuleCard eyebrow="YOUR TEAM" title="My team">
        <p className={rx['module-lede']}>People who work with you. Their names are filled in for you in the wellness check at check-in.</p>
      <form className={s.wlAdd} onSubmit={add}>
        <label className={s.srOnly} htmlFor="team-name">Name</label>
        <input id="team-name" value={name} maxLength={80} placeholder="Name" onChange={e => setName(e.target.value)} />
        <label className={s.srOnly} htmlFor="team-role">Role</label>
        <select id="team-role" value={role} onChange={e => setRole(e.target.value as 'Lead' | 'Member')}><option value="Member">Team member</option><option value="Lead">Lead</option></select>
        <button type="submit" className={s.cwYes} disabled={busy}>Add</button>
      </form>
      {error && <p className={s.cwErr} role="alert">{error}</p>}
      <LoadError error={data.error} what="your team" onRetry={data.reload} />
      {data.data && active.length === 0 && <Empty>No one on your team yet. Add the people you work with.</Empty>}
      <ul className={s.nmList}>
        {active.map(m => (
          <li key={m.id} className={s.nmItem}>
            <strong>{m.personName}</strong><small>{m.role === 'Lead' ? 'Lead' : 'Team member'}</small>
            <button type="button" className={s.cwSkip} disabled={busy} aria-label={`Remove ${m.personName}`} onClick={() => run(source.setTeamMemberActive(m.id, false), 'Removed from your team.')}>Remove</button>
          </li>
        ))}
      </ul>
      {gone.length > 0 && (
        <details className={s.pdDetails}>
          <summary>Removed ({gone.length})</summary>
          <ul className={s.nmList}>
            {gone.map(m => (
              <li key={m.id} className={s.nmItem}><strong>{m.personName}</strong>
                <button type="button" className={s.cwSkip} disabled={busy} aria-label={`Bring back ${m.personName}`} onClick={() => run(validateTeamName(m.personName, team).length ? Promise.reject(new Error('That person is already on your team.')) : source.setTeamMemberActive(m.id, true), 'Back on your team.')}>Bring back</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      </ModuleCard>
    </section>
  );
}

import { toTeamItem, validateTeamName, wellnessNames } from './team';
import type { ITeamMember } from './contracts';

const t = (id: number, name: string, role: 'Lead' | 'Member' = 'Member', active = true): ITeamMember => ({ id, teamMemberId: `t${id}`, personName: name, role, active });

describe('team roster', () => {
  it('validates the name and rejects an active duplicate (case-insensitive) but allows re-adding a deactivated person', () => {
    expect(validateTeamName('Ana', [])).toEqual([]);
    expect(validateTeamName('A', []).length).toBe(1);
    expect(validateTeamName('x'.repeat(81), []).length).toBe(1);
    expect(validateTeamName('ana', [t(1, 'Ana')]).length).toBe(1);
    expect(validateTeamName('ana', [t(1, 'Ana', 'Member', false)])).toEqual([]);
  });
  it('lists active names for the wellness check, lead first then alphabetical', () => {
    expect(wellnessNames([t(1, 'Zed'), t(2, 'Bo'), t(3, 'Cy', 'Lead'), t(4, 'Gone', 'Member', false)])).toEqual(['Cy', 'Bo', 'Zed']);
    expect(wellnessNames([])).toEqual([]);
  });
  it('builds an active intake item', () => {
    expect(toTeamItem('f', ' Ana ', 'Lead', 't1')).toMatchObject({ PersonName: 'Ana', Role: 'Lead', Active: true, TeamMemberId: 't1' });
  });
});

// The member's own team roster. It only prefills names in the wellness check; nothing here grants access to anything.
import type { ITeamMember } from './contracts';

export function validateTeamName(name: string, existing: ITeamMember[]): string[] {
  const n: string = name.trim();
  if (n.length < 2 || n.length > 80) { return ['Enter a name of 2 to 80 characters.']; }
  if (existing.some(m => m.active && m.personName.toLowerCase() === n.toLowerCase())) { return ['That person is already on your team.']; }
  return [];
}

export function toTeamItem(facilityId: string, name: string, role: 'Lead' | 'Member', teamMemberId: string): Record<string, unknown> {
  return { Title: name.trim(), FacilityId: facilityId, TeamMemberId: teamMemberId, PersonName: name.trim(), Role: role, Active: true };
}

/** Names for the wellness check: active people, the lead first, then alphabetical. */
export function wellnessNames(team: ITeamMember[]): string[] {
  return team.filter(m => m.active).sort((a, b) => (a.role === b.role ? a.personName.localeCompare(b.personName) : a.role === 'Lead' ? -1 : 1)).map(m => m.personName);
}

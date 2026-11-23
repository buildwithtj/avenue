import { userEmailOf } from './user';
describe('userEmailOf', () => {
  it('prefers the e-mail', () => { expect(userEmailOf('a@b.com', 'x')).toBe('a@b.com'); });
  it('reads a claims login name', () => { expect(userEmailOf('', 'i:0#.f|membership|pat@x.com')).toBe('pat@x.com'); });
  it('gives nothing rather than a claims string', () => { expect(userEmailOf('', 'c:0(.s|true')).toBe(''); });
});

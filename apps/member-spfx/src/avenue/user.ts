/** Guest accounts can have an empty e-mail and a claims login name such as "i:0#.f|membership|pat@x.com"; take the address after the last "|". */
export function userEmailOf(email: string, loginName: string): string {
  if (email) { return email; }
  const tail: string = (loginName || '').split('|').pop() || '';
  return /^[^@\s]+@[^@\s]+$/.test(tail) ? tail : '';
}

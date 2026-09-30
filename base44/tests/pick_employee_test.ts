import { pickEmployeeForEmail } from '../functions/completeOnboarding/_pickEmployee.ts';

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}
const row = (o: Record<string, unknown>) => ({ id: 'e1', email: 'ana@x.com', company_id: 'c1', role: 'employee', ...o });

Deno.test('matches ignoring case and whitespace', () => {
  eq(pickEmployeeForEmail([row({ email: ' Ana@X.com ' })], 'ANA@x.com')?.id, 'e1', 'match');
});
Deno.test('no row for the email yields null (no access)', () => {
  eq(pickEmployeeForEmail([row({})], 'otra@x.com'), null, 'other email');
  eq(pickEmployeeForEmail([], 'ana@x.com'), null, 'empty');
  eq(pickEmployeeForEmail([row({})], ''), null, 'blank email');
});
Deno.test('inactive rows are not invitations', () => {
  eq(pickEmployeeForEmail([row({ status: 'inactive' })], 'ana@x.com'), null, 'inactive');
});
Deno.test('unknown or platform roles and missing company grant nothing', () => {
  eq(pickEmployeeForEmail([row({ role: 'super_admin' })], 'ana@x.com'), null, 'super_admin');
  eq(pickEmployeeForEmail([row({ role: undefined })], 'ana@x.com'), null, 'no role');
  eq(pickEmployeeForEmail([row({ company_id: '' })], 'ana@x.com'), null, 'no company');
});
Deno.test('several matches resolve to one deterministic company', () => {
  const rows = [
    row({ id: 'b', company_id: 'c2', created_date: '2026-02-01' }),
    row({ id: 'a', company_id: 'c1', created_date: '2026-01-01' }),
    row({ id: 'z', company_id: 'c3', status: 'inactive', created_date: '2025-01-01' }),
  ];
  eq(pickEmployeeForEmail(rows, 'ana@x.com')?.id, 'a', 'oldest active');
});

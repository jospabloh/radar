// Import-free on purpose: `deno test` loads it without the SDK (npm:/deno.land
// resolution is blocked in the dev sandbox). Used by completeOnboarding.
//
// Which Employee row (the invitation an admin created) belongs to this signed-in
// email? Rules, all fail-closed:
//   - email match is case- and whitespace-insensitive (an admin types
//     "Ana@Empresa.com", the account holds "ana@empresa.com");
//   - a row marked `inactive` (dado de baja) is NOT an invitation;
//   - a row without a company_id or with a role outside the known set grants
//     nothing (the role is never "whatever string is stored");
//   - if several rows match, the oldest active one wins deterministically, so a
//     user always resolves to one company.
export const ONBOARDING_ROLES = ['company_admin', 'store_manager', 'employee'] as const;

export interface EmployeeRow {
  id: string;
  email?: string;
  company_id?: string;
  role?: string;
  status?: string;
  created_date?: string;
}

export const normalizeEmail = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function pickEmployeeForEmail(rows: EmployeeRow[], email: string): EmployeeRow | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  const eligible = rows.filter(
    (r) =>
      normalizeEmail(r.email) === target &&
      r.status !== 'inactive' &&
      !!r.company_id &&
      (ONBOARDING_ROLES as readonly string[]).includes(r.role ?? ''),
  );
  eligible.sort((a, b) => String(a.created_date ?? '').localeCompare(String(b.created_date ?? '')));
  return eligible[0] ?? null;
}

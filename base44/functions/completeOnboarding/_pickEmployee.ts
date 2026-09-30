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

// Distinct spellings worth querying: the raw value, trimmed, and trimmed+lowercased.
// Base44 filters are exact-case, so rows stored before emails were canonicalised
// are only reachable through the spelling they were typed with.
export function emailQueryVariants(raw: unknown): string[] {
  const r = String(raw ?? '');
  return [...new Set([r, r.trim(), r.trim().toLowerCase()].filter((v) => v.length > 0))];
}

export function mergeById<T extends { id: string }>(lists: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const list of lists) for (const row of list) if (!seen.has(row.id)) seen.set(row.id, row);
  return [...seen.values()];
}

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

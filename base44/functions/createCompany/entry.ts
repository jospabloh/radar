// createCompany — the sanctioned way to create a new tenant, now that
// Company.jsonc's `create` rule only grants the direct client path to
// Base44's PLATFORM `role: admin` (the app's own collaborator account).
//
// Why this exists: SuperAdminCompanies.jsx called `base44.entities.Company.
// create(...)` directly, relying on RADAR's own `app_role: 'super_admin'`
// custom field to gate the page. But Base44's RLS `user_condition` can only
// check the platform `role` field, never a custom field like `app_role` —
// the same constraint module 14's CLAUDE.md write-up already documents for
// `PermissionProfile`. So any account that is a RADAR `super_admin` without
// ALSO being a Base44 platform admin/collaborator on this app (e.g. the
// founder-bootstrap path in completeOnboarding, which only ever sets the
// custom `app_role` field and never touches platform `role`) got a silent
// 403 "Permission denied for create operation on Company entity" the moment
// it tried to use the one screen its role exists to drive. Confirmed live
// against the deployed app with a second super_admin test account (QA pass,
// 2026-10-02): `base44.entities.Company.create` returned exactly that 403.
//
// Fixed the same way `createEmployee` already closed the matching gap on
// `Employee.create`: a service-role function that re-checks RADAR's own
// `app_role` field in code (where it's actually readable) instead of
// relying on RLS to see a field it structurally cannot.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, is_mexican, tier, max_employees } = await req.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }
    const allowedTiers = new Set(['starter', 'pro', 'enterprise']);
    const resolvedTier = allowedTiers.has(tier) ? tier : 'starter';

    const sr = base44.asServiceRole;
    const company = await sr.entities.Company.create({
      name: name.trim(),
      is_mexican: is_mexican ?? true,
      tier: resolvedTier,
      max_employees: typeof max_employees === 'number' && max_employees > 0 ? max_employees : 15,
    });

    return Response.json({ success: true, company });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

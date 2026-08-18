// Colocated copy — Deno functions can't import across function directories,
// so this exists once per function that needs it (createEmployee,
// createManagedRecord, resolveApprovalRequest, updateAttendanceRecord).
// Keep all copies identical; regenerate by hand if the logic changes.
//
// Blocks a write when the caller's tenant Company.status is suspended or
// view_only — the billing-status write gate every other portfolio app's
// Safe functions already have (see jospabloh/acacia-app-standard, module 3),
// which this app's five Safe functions never had: they re-check app_role and
// tenant scoping, but nothing here ever read Company.status. super_admin
// (platform owner) bypasses this, matching the precedence every other check
// in this app already uses (super_admin is cross-tenant/service-role tier).
export async function assertCompanyWritable(sr, companyId, appRole) {
  if (appRole === 'super_admin') return null;
  if (!companyId) return { error: 'company_id_required', status: 400 };
  const companies = await sr.entities.Company.filter({ id: companyId });
  const company = companies[0];
  if (!company) return { error: 'company_not_found', status: 404 };
  if (company.status === 'suspended' || company.status === 'view_only') {
    return {
      error: 'write_blocked',
      message: 'This company\'s license is suspended or read-only.',
      status: 403,
    };
  }
  return null;
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// exportCompanyData — "Descargar mis datos" for module 7 (cuenta y zona de
// peligro). CompanySettings.jsx only ever exposed 3 editable fields (name,
// timezone, whatsapp_enabled) with no export and no danger zone at all.
//
// Runs as service role to read across every company-scoped entity without
// depending on each one's own RLS shape — but every read is explicitly
// filtered to the caller's own company_id, never cross-tenant. Gated to
// company_admin/super_admin, same roles CompanySettings' own edit access
// implicitly assumes (Company.update RLS allows any member, but exporting
// the whole company's records is a managerial action).

const MANAGER_ROLES = new Set(['company_admin', 'store_manager', 'super_admin']);

const COMPANY_ENTITIES = [
  'Employee', 'EmployeeDocument', 'AttendanceRecord', 'ExtensionRequest',
  'PTORequest', 'ScheduleChangeRequest', 'ShiftTemplate', 'Holiday',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = user.app_role === 'super_admin';
    if (!isSuperAdmin && !MANAGER_ROLES.has(user.app_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const companyId = user.company_id;
    if (!companyId) return Response.json({ error: 'No tienes una empresa asignada' }, { status: 400 });

    const sr = base44.asServiceRole;
    const company = await sr.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });

    const data: Record<string, unknown[]> = {};
    for (const entity of COMPANY_ENTITIES) {
      try {
        data[entity] = await sr.entities[entity].filter({ company_id: companyId });
      } catch (e) {
        data[entity] = [];
        console.error(`[exportCompanyData] ${entity} failed: ${(e as Error).message}`);
      }
    }

    return Response.json({
      success: true,
      exported_at: new Date().toISOString(),
      company: { id: company.id, name: company.name, status: company.status },
      data,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

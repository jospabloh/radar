// createManagedRecord — manager-only create (and, for ShiftTemplate,
// delete) for entities whose write RLS is now service-role only because
// the caller who legitimately writes them isn't the record's own subject:
//
//   - ScheduleChangeRequest: a manager proposes a schedule change FOR
//     another employee (ScheduleChangeDialog.jsx, only reachable from the
//     admin/manager Employees.jsx page) — scoping create to "own
//     employee_id" (like PTORequest/ExtensionRequest) would break this.
//   - ShiftTemplate: company-wide shift templates, meant to be
//     manager-managed, not self-service. Its `delete` rule was already
//     service-role only before this change (a pre-existing bug: the delete
//     button in ShiftSettings.jsx could never have worked for a real user),
//     so `delete` is included here too, fixing that alongside the new
//     `create` gate.
//
// Neither case can be expressed as a declarative RLS rule (no app_role
// membership check exists in Base44's rule language), so both go through
// this function instead, verifying the caller's app_role and tenant before
// writing via asServiceRole (which bypasses RLS — the checks below are the
// only gate).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { assertCompanyWritable } from './_billingGuard.ts';
import { assertPermission } from './_permissions.ts';

const ENTITIES = new Set(['ScheduleChangeRequest', 'ShiftTemplate']);
const DELETABLE_ENTITIES = new Set(['ShiftTemplate']);
const MANAGER_ROLES = new Set(['company_admin', 'store_manager', 'super_admin']);
// Which granular permission key gates each managed entity. ShiftTemplate is
// company-wide configuration (admin-tier by default); proposing a schedule
// change for someone else is day-to-day manager work.
const ENTITY_PERMISSION: Record<string, string> = {
  ScheduleChangeRequest: 'Empleados:propose_schedule',
  ShiftTemplate: 'Horarios:manage',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGER_ROLES.has(user.app_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { entity, action, data, recordId } = await req.json();
    if (!ENTITIES.has(entity)) {
      return Response.json({ error: 'entity must be one of ScheduleChangeRequest, ShiftTemplate' }, { status: 400 });
    }

    const sr = base44.asServiceRole;

    if (action === 'delete') {
      if (!DELETABLE_ENTITIES.has(entity)) {
        return Response.json({ error: `${entity} does not support delete via this function` }, { status: 400 });
      }
      if (!recordId) return Response.json({ error: 'recordId is required' }, { status: 400 });
      const records = await sr.entities[entity].filter({ id: recordId });
      const record = records[0];
      if (!record) return Response.json({ error: 'not_found' }, { status: 404 });
      if (user.app_role !== 'super_admin' && record.company_id !== user.company_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Module 3: the granular key for this entity, checked against the
      // record's OWN tenant. ENTITY_PERMISSION keeps the mapping in one place
      // so a new managed entity can't be added without choosing a key.
      const deletePerm = await assertPermission(sr, user, record.company_id, ENTITY_PERMISSION[entity]);
      if (deletePerm) return Response.json({ error: deletePerm.error, permission: deletePerm.permission, message: deletePerm.message }, { status: deletePerm.status });

      const deleteBlock = await assertCompanyWritable(sr, record.company_id, user.app_role);
      if (deleteBlock) return Response.json({ error: deleteBlock.error, message: deleteBlock.message }, { status: deleteBlock.status });
      await sr.entities[entity].delete(recordId);
      return Response.json({ success: true });
    }

    if (!data || typeof data !== 'object') {
      return Response.json({ error: 'data is required' }, { status: 400 });
    }

    const permBlock = await assertPermission(sr, user, user.company_id, ENTITY_PERMISSION[entity]);
    if (permBlock) return Response.json({ error: permBlock.error, permission: permBlock.permission, message: permBlock.message }, { status: permBlock.status });

    const createBlock = await assertCompanyWritable(sr, user.company_id, user.app_role);
    if (createBlock) return Response.json({ error: createBlock.error, message: createBlock.message }, { status: createBlock.status });

    // A ScheduleChangeRequest's employee_id is client-supplied (it's a
    // manager proposing a change FOR someone else, so it can't be scoped to
    // "own employee_id" the way PTORequest/ExtensionRequest are). Without
    // this check a manager could name an employee_id from another company;
    // company_id below would still read the caller's own, so the request
    // would look same-tenant to resolveApprovalRequest's own check — this is
    // the earlier of the two gates on that path, catching it at creation
    // instead of only at approval time.
    if (entity === 'ScheduleChangeRequest') {
      const targetEmployee = await sr.entities.Employee.get(data.employee_id).catch(() => null);
      if (!targetEmployee || targetEmployee.company_id !== user.company_id) {
        return Response.json({ error: 'cross_tenant_reference' }, { status: 400 });
      }
    }

    // company_id always comes from the caller's own tenant, never the client
    // payload — a manager can only create records for their own company.
    const payload = { ...data, company_id: user.company_id };
    const created = await sr.entities[entity].create(payload);
    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

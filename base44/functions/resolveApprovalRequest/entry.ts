// resolveApprovalRequest — manager-only approve/reject for PTORequest,
// ScheduleChangeRequest and ExtensionRequest.
//
// Why this exists: each of those three entities' `status` field is now
// FIELD-LEVEL locked to role `admin` (see their .jsonc rls) because the
// previous rule — data.company_id match, no app_role check — let any
// employee approve their own (or a coworker's) request by calling
// entities.<X>.update(id, {status: "approved"}) directly. This function
// verifies the caller is a manager for the record's own tenant, then
// performs the write with the service role (asServiceRole bypasses RLS, so
// the checks below are the only gate) — same pattern as
// updateAttendanceRecord. It also performs the side effects Approvals.jsx
// used to do client-side on approval (reconcile Employee.schedule for
// ScheduleChangeRequest; extend the AttendanceRecord for ExtensionRequest),
// so those can't be triggered without also going through the manager check.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { assertCompanyWritable } from './_billingGuard.ts';
import { assertPermission } from './_permissions.ts';

const ENTITIES = new Set(['PTORequest', 'ScheduleChangeRequest', 'ExtensionRequest']);
const STATUSES = new Set(['approved', 'rejected']);
const MANAGER_ROLES = new Set(['company_admin', 'store_manager', 'super_admin']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGER_ROLES.has(user.app_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { entity, requestId, status, manager_comment } = await req.json();
    if (!ENTITIES.has(entity)) {
      return Response.json({ error: 'entity must be one of PTORequest, ScheduleChangeRequest, ExtensionRequest' }, { status: 400 });
    }
    if (!STATUSES.has(status)) {
      return Response.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }
    if (!requestId) {
      return Response.json({ error: 'requestId is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const records = await sr.entities[entity].filter({ id: requestId });
    const record = records[0];
    if (!record) return Response.json({ error: 'not_found' }, { status: 404 });
    if (user.app_role !== 'super_admin' && record.company_id !== user.company_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Module 3: the granular key, re-checked here with the record's OWN tenant
    // (never one from the body) so a company_admin who explicitly denied their
    // store_managers this action is actually obeyed — MANAGER_ROLES above is
    // the coarse role floor, not the whole answer.
    const permBlock = await assertPermission(sr, user, record.company_id, 'Aprobaciones:resolve');
    if (permBlock) return Response.json({ error: permBlock.error, permission: permBlock.permission, message: permBlock.message }, { status: permBlock.status });

    const billingBlock = await assertCompanyWritable(sr, record.company_id, user.app_role);
    if (billingBlock) return Response.json({ error: billingBlock.error, message: billingBlock.message }, { status: billingBlock.status });

    // The side-effect targets (Employee.schedule, AttendanceRecord) are
    // asServiceRole writes keyed off employee_id/attendance_record_id fields
    // that came from whoever created this request — createManagedRecord
    // doesn't validate ScheduleChangeRequest's employee_id belongs to the
    // caller's own company, and ExtensionRequest.create's RLS never checks
    // attendance_record_id at all. Without this, a request whose *own*
    // company_id matches the approving manager (the only check above) could
    // still carry a cross-tenant reference, and approving it would write
    // into another company's Employee/AttendanceRecord row. Verified against
    // the referenced record's own stored company_id, never the request's.
    if (status === 'approved' && entity === 'ScheduleChangeRequest') {
      const targetEmployee = await sr.entities.Employee.get(record.employee_id).catch(() => null);
      if (!targetEmployee || targetEmployee.company_id !== record.company_id) {
        return Response.json({ error: 'cross_tenant_reference' }, { status: 400 });
      }
    }
    if (status === 'approved' && entity === 'ExtensionRequest') {
      const targetAttendance = await sr.entities.AttendanceRecord.get(record.attendance_record_id).catch(() => null);
      if (!targetAttendance || targetAttendance.company_id !== record.company_id) {
        return Response.json({ error: 'cross_tenant_reference' }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = { status };
    if (entity === 'PTORequest' && typeof manager_comment === 'string') {
      updates.manager_comment = manager_comment;
    }
    const updated = await sr.entities[entity].update(requestId, updates);

    if (status === 'approved' && entity === 'ScheduleChangeRequest') {
      await sr.entities.Employee.update(record.employee_id, { schedule: record.proposed_schedule });
    }
    if (status === 'approved' && entity === 'ExtensionRequest') {
      await sr.entities.AttendanceRecord.update(record.attendance_record_id, {
        status: 'extension',
        extension_minutes: record.requested_minutes,
      });
    }

    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

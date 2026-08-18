import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { assertCompanyWritable } from './_billingGuard.ts';

// updateAttendanceRecord — manager-only write path for AttendanceRecord
// fields on OTHER employees' rows (extension approval in Approvals.jsx,
// incident notes in IncidentPanel.jsx).
//
// Why this exists: AttendanceRecord's create/update RLS is now scoped to the
// caller's OWN employee_id (see base44/entities/AttendanceRecord.jsonc), so a
// self-service check-in/out can't forge another employee's row. That rule
// also blocks the legitimate manager writes above, since they target a
// different employee's record. This function verifies the caller is a
// manager for the record's own tenant, then performs the write with the
// service role (asServiceRole bypasses RLS, so tenant/role checks below are
// the only gate).
const ALLOWED_FIELDS = new Set(['status', 'extension_minutes', 'notes']);
const MANAGER_ROLES = new Set(['company_admin', 'store_manager', 'super_admin']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGER_ROLES.has(user.app_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { recordId, updates } = await req.json();
    if (!recordId || !updates || typeof updates !== 'object') {
      return Response.json({ error: 'recordId and updates are required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const records = await sr.entities.AttendanceRecord.filter({ id: recordId });
    const record = records[0];
    if (!record) return Response.json({ error: 'not_found' }, { status: 404 });
    if (user.app_role !== 'super_admin' && record.company_id !== user.company_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const billingBlock = await assertCompanyWritable(sr, record.company_id, user.app_role);
    if (billingBlock) return Response.json({ error: billingBlock.error, message: billingBlock.message }, { status: billingBlock.status });

    const safeUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.has(key)) safeUpdates[key] = value;
    }
    if (Object.keys(safeUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await sr.entities.AttendanceRecord.update(recordId, safeUpdates);
    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

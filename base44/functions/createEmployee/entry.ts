// createEmployee — the only sanctioned way to invite a user and create their
// Employee row, now that Employee.jsonc's `create` rule is service-role
// only. Two callers, two different privilege shapes:
//
//   - EmployeeFormDialog.jsx (Employees.jsx, company_admin/store_manager):
//     invites an employee/store_manager into the CALLER'S OWN company. Role
//     is restricted to employee|store_manager — this path can't grant
//     company_admin, matching what the dialog's dropdown already offered.
//   - SuperAdminCompanies.jsx (super_admin only): invites a company_admin
//     into an ARBITRARY company (super_admin is a cross-tenant platform
//     role) — company_id comes from the request, not the caller's own.
//
// Why this exists: Employee.create previously had no role check at all —
// any authenticated company member could call it directly and set `role`
// to company_admin on a brand-new row. That's a narrower version of the
// self-escalation bug already fixed on Employee.update (see Employee.jsonc);
// this closes the matching create-time gap. base44.users.inviteUser is
// called with the CALLER'S OWN client (not asServiceRole) because it
// already worked that way when invoked directly from the browser with a
// non-admin end-user token — this function only adds the role/tenant
// validation the client-side call never had, it doesn't change what
// privilege inviteUser itself requires.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { assertCompanyWritable } from './_billingGuard.ts';
import { assertPermission } from './_permissions.ts';

const MANAGER_ROLES = new Set(['company_admin', 'store_manager']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = user.app_role === 'super_admin';
    const isManager = MANAGER_ROLES.has(user.app_role);
    if (!isSuperAdmin && !isManager) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, full_name, role, company_id, schedule, hire_date } = await req.json();
    if (!email || !full_name) {
      return Response.json({ error: 'email and full_name are required' }, { status: 400 });
    }

    let targetCompanyId;
    let grantedRole;
    if (isSuperAdmin) {
      if (!company_id) {
        return Response.json({ error: 'company_id is required for a super_admin invite' }, { status: 400 });
      }
      if (role !== 'company_admin') {
        return Response.json({ error: 'role must be company_admin for a super_admin invite' }, { status: 400 });
      }
      targetCompanyId = company_id;
      grantedRole = 'company_admin';
    } else {
      if (role !== 'employee' && role !== 'store_manager') {
        return Response.json({ error: 'role must be employee or store_manager' }, { status: 400 });
      }
      targetCompanyId = user.company_id;
      grantedRole = role;
    }

    const sr = base44.asServiceRole;
    // A super_admin names the company in the request: make sure it exists so an
    // Employee row is never created pointing at nothing.
    if (isSuperAdmin) {
      const found = await sr.entities.Company.filter({ id: targetCompanyId });
      if (found.length === 0) return Response.json({ error: 'company_not_found' }, { status: 404 });
    }
    // Module 3: checked against the tenant the invite TARGETS (a super_admin
    // may invite into any company), before inviteUser fires — a denied caller
    // must not cause a real invitation email either.
    const permBlock = await assertPermission(sr, user, targetCompanyId, 'Empleados:create');
    if (permBlock) return Response.json({ error: permBlock.error, permission: permBlock.permission, message: permBlock.message }, { status: permBlock.status });

    const billingBlock = await assertCompanyWritable(sr, targetCompanyId, user.app_role);
    if (billingBlock) return Response.json({ error: billingBlock.error, message: billingBlock.message }, { status: billingBlock.status });

    // One person, one company: an email that already has an Employee row (any
    // company) cannot be invited again. completeOnboarding resolves an email to
    // exactly one row, so a second invite would either be dead or silently
    // decided by whichever row sorts first. Runs before inviteUser so a refused
    // invite sends no email.
    const wanted = String(email).trim().toLowerCase();
    const existing = await sr.entities.Employee.filter({ email: String(email).trim() });
    const existingLower = wanted !== String(email).trim() ? await sr.entities.Employee.filter({ email: wanted }) : [];
    if ([...existing, ...existingLower].some((e: { status?: string }) => e.status !== 'inactive')) {
      return Response.json(
        { error: 'email_already_registered', message: 'Ese correo ya está dado de alta en una empresa. Una persona solo puede pertenecer a una.' },
        { status: 409 },
      );
    }

    await base44.users.inviteUser(email, 'user');

    const employee = await sr.entities.Employee.create({
      email,
      full_name,
      role: grantedRole,
      company_id: targetCompanyId,
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      ...(schedule ? { schedule } : {}),
    });

    return Response.json({ success: true, employee });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

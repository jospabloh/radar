// CANONICAL SOURCE — do not edit the colocated copies.
//
// Deno functions can't import across function directories, so this file is
// fanned out to one copy per function that needs it, exactly like
// `_billingGuard.ts` already is. `npm run generate:function-permissions`
// copies it; `npm run validate:permissions` fails the build if a copy drifts
// from this file OR if this file drifts from src/lib/permissionRegistry.js.
//
// Server-side mirror of src/lib/PermissionContext.jsx's `can()`, in the same
// precedence order:
//   1. super_admin → always allowed (platform tier);
//   2. an explicit true/false override for (company_id, role, key) in that
//      tenant's PermissionProfile wins;
//   3. else the registry default for the role.
// The billing gate is step 4 and lives in _billingGuard.ts, kept separate
// because read-only paths (exportCompanyData) need this check and not that one.

// AUTOGEN:PERMISSION_REGISTRY:BEGIN — mirror of src/lib/permissionRegistry.js
const PERMISSION_REGISTRY: Record<string, Record<string, boolean>> = {
  'Asistencias:view_all': { company_admin: true, store_manager: true, employee: false },
  'Asistencias:edit': { company_admin: true, store_manager: true, employee: false },
  'Aprobaciones:view': { company_admin: true, store_manager: true, employee: false },
  'Aprobaciones:resolve': { company_admin: true, store_manager: true, employee: false },
  'Empleados:view': { company_admin: true, store_manager: true, employee: false },
  'Empleados:create': { company_admin: true, store_manager: false, employee: false },
  'Empleados:propose_schedule': { company_admin: true, store_manager: true, employee: false },
  'Horarios:manage': { company_admin: true, store_manager: false, employee: false },
  'Empresa:edit_settings': { company_admin: true, store_manager: false, employee: false },
  'Empresa:export_data': { company_admin: true, store_manager: true, employee: false },
  'Empresa:request_deletion': { company_admin: true, store_manager: false, employee: false },
  'Soporte:create_ticket': { company_admin: true, store_manager: true, employee: true },
  'Soporte:reply': { company_admin: true, store_manager: true, employee: true },
};
// AUTOGEN:PERMISSION_REGISTRY:END

/**
 * @param sr        base44.asServiceRole
 * @param user      the caller, from base44.auth.me()
 * @param companyId the tenant the write targets — ALWAYS the record's own
 *                  company_id, never one taken from the request body.
 * @param key       "Section:action"
 * @returns null when allowed, or an error object to return verbatim.
 */
export async function assertPermission(sr, user, companyId, key) {
  const role = user?.app_role;
  if (role === 'super_admin') return null;
  if (!role) return { error: 'forbidden', status: 403 };

  if (!(key in PERMISSION_REGISTRY)) {
    // An unknown key is a bug, not an open door.
    return { error: 'unknown_permission', message: key, status: 500 };
  }

  if (companyId) {
    const profiles = await sr.entities.PermissionProfile.filter({
      company_id: companyId,
      role_key: role,
    });
    const override = profiles?.[0]?.permissions?.[key];
    if (override === true) return null;
    if (override === false) return { error: 'forbidden', permission: key, status: 403 };
  }

  if (PERMISSION_REGISTRY[key][role] === true) return null;
  return { error: 'forbidden', permission: key, status: 403 };
}

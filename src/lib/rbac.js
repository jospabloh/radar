// Single source of truth for RADAR's OWN role model (STANDARD.md Module 2).
//
// Before this file, the four roles existed only as string literals scattered
// across AppLayout.jsx, CompanySettings.jsx, Approvals.jsx, Employees.jsx,
// EmployeeProfile.jsx, AttendanceCalendar.jsx and five backend functions —
// with three independent copies of the manager set and three of the label map,
// already slightly different from each other (Employees.jsx labelled
// store_manager "Store Manager", EmployeeProfile.jsx "Gerente de tienda", and
// neither knew about super_admin). Declare a role here and nowhere else.
//
// This is Layer 2 of the standard's two-layer model. Layer 1 — Mission
// Control's operator roles (owner|admin|viewer in its own `members` table) —
// governs who can drive the central PANEL, has no meaning inside this app, and
// must never be conflated with these. Mission Control reaches this app's data
// through the service-role `acaciaControl` bridge, not by impersonating one of
// these roles.
//
// `app_role` is a custom field on the Base44 User, field-locked to admin-only
// writes (see base44/entities/User.jsonc) and set exclusively by
// base44/functions/completeOnboarding — never by a raw auth.updateMe() from
// the client.

export const ROLES = {
  // Platform/ACACIA tier. Cross-tenant, carries no company_id, and is the
  // branch every entity's RLS service-role rule is written against. Never
  // assigned to a tenant's own staff.
  SUPER_ADMIN: "super_admin",
  // Tenant owner — full access within their own company_id.
  COMPANY_ADMIN: "company_admin",
  // Runs one store: approvals, incidents, attendance for their team.
  STORE_MANAGER: "store_manager",
  // Clocks in and out, files their own requests. Nothing else.
  EMPLOYEE: "employee",
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: "Super administrador",
  [ROLES.COMPANY_ADMIN]: "Administrador",
  [ROLES.STORE_MANAGER]: "Gerente de tienda",
  [ROLES.EMPLOYEE]: "Empleado",
};

/**
 * Roles that manage other people's records. This is the set the five backend
 * Safe functions gate on, and the one three pages each had their own copy of.
 */
export const MANAGER_ROLES = new Set([
  ROLES.COMPANY_ADMIN,
  ROLES.STORE_MANAGER,
  ROLES.SUPER_ADMIN,
]);

/** Roles that belong to a tenant (i.e. everyone except the platform tier). */
export const TENANT_ROLES = [ROLES.COMPANY_ADMIN, ROLES.STORE_MANAGER, ROLES.EMPLOYEE];

export function getAppRole(user) {
  return user?.app_role || null;
}

export function isSuperAdmin(user) {
  return getAppRole(user) === ROLES.SUPER_ADMIN;
}

export function isCompanyAdmin(user) {
  return getAppRole(user) === ROLES.COMPANY_ADMIN;
}

export function isManager(user) {
  return MANAGER_ROLES.has(getAppRole(user));
}

export function isEmployee(user) {
  return getAppRole(user) === ROLES.EMPLOYEE;
}

/** Has this user finished onboarding (been assigned a role and a tenant)? */
export function hasTenant(user) {
  return Boolean(user?.company_id) || isSuperAdmin(user);
}

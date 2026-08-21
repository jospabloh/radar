// Granular permission registry (STANDARD.md Module 3).
//
// One place listing every gated action as "Section:action", with a default per
// role. This file alone is NOT the enforcement boundary — `can()` only hides
// UI. Every key here is independently re-checked server-side by the function
// that performs the write, in the SAME precedence order:
//
//   1. super_admin → always allowed (platform tier);
//   2. an explicit true/false override for (company_id, role, key) in a
//      `PermissionProfile` row wins — that is how a company_admin tunes what
//      their own store_manager/employee can do beyond the defaults below;
//   3. Company.status suspended/view_only → every WRITE rejected regardless
//      (see base44/functions/*/_billingGuard.ts);
//   4. else the default for the caller's role, below.
//
// Server-side mirrors live in base44/functions/*/_permissions.ts (Deno cannot
// import from src/). `npm run validate:permissions` fails the build on drift.

import { ROLES } from "./rbac";

const { COMPANY_ADMIN, STORE_MANAGER, EMPLOYEE } = ROLES;

/**
 * key -> { role: boolean }. super_admin is deliberately absent: it is handled
 * as an unconditional bypass in resolvePermission(), matching how every
 * backend check in this app already treats it.
 */
export const PERMISSION_REGISTRY = {
  // Asistencias — the attendance record itself.
  "Asistencias:view_all": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },
  "Asistencias:edit": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },

  // Aprobaciones — PTO, schedule changes, extensions.
  "Aprobaciones:view": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },
  "Aprobaciones:resolve": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },

  // Empleados — the roster.
  "Empleados:view": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },
  "Empleados:create": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: false, [EMPLOYEE]: false },
  "Empleados:propose_schedule": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },

  // Horarios — company-wide shift templates.
  "Horarios:manage": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: false, [EMPLOYEE]: false },

  // Empresa — settings and the danger zone.
  "Empresa:edit_settings": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: false, [EMPLOYEE]: false },
  "Empresa:export_data": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: false },
  "Empresa:request_deletion": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: false, [EMPLOYEE]: false },

  // Soporte — deliberately open to every role, including employee: a person
  // locked out of everything else still has to be able to say so. It is also
  // the one write path left outside the billing gate, for the same reason.
  "Soporte:create_ticket": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: true },
  "Soporte:reply": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: true, [EMPLOYEE]: true },
};

/** Grouped metadata, for a future per-tenant permission editor UI. */
export const PERMISSION_SECTIONS = [
  {
    section: "Asistencias",
    label: "Asistencias",
    keys: [
      { key: "Asistencias:view_all", label: "Ver asistencias de todo el equipo" },
      { key: "Asistencias:edit", label: "Editar asistencias e incidencias" },
    ],
  },
  {
    section: "Aprobaciones",
    label: "Aprobaciones",
    keys: [
      { key: "Aprobaciones:view", label: "Ver solicitudes del equipo" },
      { key: "Aprobaciones:resolve", label: "Aprobar o rechazar solicitudes" },
    ],
  },
  {
    section: "Empleados",
    label: "Empleados",
    keys: [
      { key: "Empleados:view", label: "Ver el directorio de empleados" },
      { key: "Empleados:create", label: "Dar de alta empleados" },
      { key: "Empleados:propose_schedule", label: "Proponer cambios de horario" },
    ],
  },
  {
    section: "Horarios",
    label: "Horarios",
    keys: [{ key: "Horarios:manage", label: "Administrar plantillas de turno" }],
  },
  {
    section: "Empresa",
    label: "Empresa",
    keys: [
      { key: "Empresa:edit_settings", label: "Editar los datos de la empresa" },
      { key: "Empresa:export_data", label: "Exportar los datos de la empresa" },
      { key: "Empresa:request_deletion", label: "Solicitar la eliminación de la empresa" },
    ],
  },
  {
    section: "Soporte",
    label: "Soporte",
    keys: [
      { key: "Soporte:create_ticket", label: "Abrir tickets de soporte" },
      { key: "Soporte:reply", label: "Responder tickets de soporte" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_REGISTRY);

/** The registry default for a role, with no override applied. */
export function registryDefault(key, role) {
  return Boolean(PERMISSION_REGISTRY[key]?.[role]);
}

/**
 * Full precedence, minus the billing gate (which only applies to writes and is
 * enforced server-side by _billingGuard.ts — the client shows the
 * CompanyStatusBanner for that instead of silently hiding every button).
 */
export function resolvePermission(key, role, overrides) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const override = overrides?.[key];
  if (override === true || override === false) return override;
  return registryDefault(key, role);
}

/** Every default for a role, as a flat map — used to seed the editor UI. */
export function getDefaultsForRole(role) {
  const out = {};
  for (const key of ALL_PERMISSION_KEYS) out[key] = registryDefault(key, role);
  return out;
}

# RADAR — Project Notes

Attendance/HR SaaS (Base44 backend + Vite/React front-end), multi-tenant via
`company_id` on every operational entity. Roles: `super_admin` (platform),
`company_admin`, `store_manager`, `employee` (`user.app_role`).

## Billing write-gate on Safe functions (module 3, fixed 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 3) found
`updateAttendanceRecord`, `resolveApprovalRequest`, `createManagedRecord`, and
`createEmployee` re-checked `app_role` and tenant scoping but never
`Company.status` — a suspended or view_only tenant's manager could still
approve requests, edit attendance, create shift templates, and invite
employees. Fixed: all four now check `Company.status` before writing
(`_billingGuard.ts`, colocated per function directory — Deno can't import
across function dirs — checked right after the existing tenant-scoping
check, `super_admin` bypasses same as every other check in this app).
`createEmployee`'s check runs before `base44.users.inviteUser` fires, so a
blocked company doesn't send a real invite email before rejecting the write.
`updateSupportTicket` deliberately left ungated so a suspended company keeps
its one path to fix the underlying billing problem.

**Not verified:** `deno` isn't available in this sandbox, and this repo's CI
has no `deno lint`/`deno test` step for `base44/functions/*.ts` at all
(confirmed via `.github/workflows/ci.yml`) — reviewed all four edited
`entry.ts` files by hand for syntax/logic; live behavior needs a manual
check against the deployed backend before treating this as fully verified.

## Account & danger zone (module 7, added 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 7) found
`CompanySettings.jsx` only ever exposed 3 editable fields (name, timezone,
`whatsapp_enabled`) — no data export, no danger zone. New:

- **`exportCompanyData`** (`company_admin`/`store_manager`/`super_admin`) —
  service role, but every read explicitly filtered by the caller's own
  `company_id`. Returns `Employee`, `EmployeeDocument`, `AttendanceRecord`,
  `ExtensionRequest`, `PTORequest`, `ScheduleChangeRequest`, `ShiftTemplate`,
  `Holiday` as one JSON payload; `CompanySettings.jsx` turns it into a
  client-side download.
- **"Solicitar eliminación de la empresa"** — **not** a direct delete.
  `Company.delete`'s RLS requires `role: admin` (the platform owner) —
  a tenant's own `company_admin` cannot delete their own company via RLS at
  all, by design. So this creates a `SupportTicket` (`category: 'account'`,
  `priority: 'high'`) and notifies Mission Control via the existing
  `notifyTicketCreated` function (same call `SupportCenter.jsx` already
  makes on ticket creation), same principle as every other irreversible,
  tenant-wide deletion in this portfolio going through a human rather than
  instant self-service (see `jospabloh/liuma`'s own module-7 finding for the
  cautionary counter-example of *not* doing this).

**Verified:** `npm run lint`, `npm run build` pass. No `deno`/RLS-validator
script in this repo to run locally (see the 2026-08-17 fix's PR for the same
caveat) — unverified against a live deploy.

## No "trial" state on `Company.status` — investigated, correctly modeled as-is (2026-08-18)

A portfolio-standard audit flagged module 1 (licencias) for not modeling a
"trial" phase on `Company.status` (`["active", "suspended", "view_only"]`),
the way `jospabloh/acacia-mission-control`'s unified lifecycle models it for
other apps (a `trial` **plan** value plus a `trialField` date, per
`api/_lib/licenseControl.js`). Investigated rather than added by default,
because a trial phase needs a real trigger — something that starts the
clock — and RADAR genuinely doesn't have one:

- **There is no self-serve "create a company" signup.** `Register.jsx`
  creates a Base44 **user** account only (`base44.auth.register`); it never
  creates a `Company`. `completeOnboarding/entry.ts` — the server-side
  function that actually assigns a new user's `app_role`/`company_id` — has
  exactly two paths: (1) an admin already created an `Employee` row for that
  email beforehand (an invitation, inheriting whatever role/company that
  admin assigned), or (2) zero `Company` rows exist **anywhere in the whole
  app** yet, making this the one-time founder bootstrap. Once the first
  company ever exists, path 2 is permanently dead — every subsequent company
  is created exclusively through `SuperAdminCompanies.jsx`, a `super_admin`-
  only manual form that sets `tier`/`max_employees` directly and leaves
  `status` at its `active` default. No code path anywhere sets a trial
  length or a trial-end date, because nothing needs to.
- **This isn't an oversight — it matches how the product is actually sold.**
  Unlike flowfin/rumbo/liuma/puntos/stockflow, which all have a public
  self-serve signup that starts a trial clock the moment someone creates a
  tenant, RADAR's tenants are provisioned by ACACIA directly — sales-led,
  not self-serve. **Correction (2026-08-19):** this section originally cited
  "no `apps/radar.html` marketing page in `acaciaco-site`" as supporting
  evidence for that claim — module 9's own gap at the time this was written.
  `apps/radar.html` was added the same day (see module 9 elsewhere in this
  file's git history / the portfolio audit), so that specific citation is
  now stale; a marketing page existing doesn't create a self-serve signup
  flow on its own, so the underlying conclusion (no trial trigger, `active`-
  by-default is correct) still holds — just not for that specific reason
  anymore. A "trial" status with no trigger anywhere to enter it would be
  exactly the same shape of problem as `jospabloh/liuma`'s unwired
  danger-zone table — schema and UI built for a flow that doesn't exist,
  which reads as done without doing anything.

**Conclusion: `Company.status`'s three-value enum is correct for RADAR's
actual onboarding model.** If self-serve signup is ever built for RADAR,
that is the point to add `trial` (mirroring rumbo's `plans: ['trial', ...]`
+ `billing.trialField` pattern in `licenseControl.js`) — building it now,
ahead of any real entry point, would be speculative.

## Billing-status banner (module 10, added 2026-08-18)

`Company.status` was never read anywhere in the client before this — not
just missing from the login screen (structurally correct, same reasoning
as `jospabloh/flowfin`'s equivalent finding: a pre-auth screen can't know
which tenant it is), but missing **everywhere**, including every
authenticated page. The module-3 billing write-gate
(`base44/functions/*/_billingGuard.ts`) already rejects writes server-side
for a `suspended`/`view_only` company, but a blocked user saw only a
generic error toast with no explanation of why.

New **`CompanyStatusBanner`** (`src/components/layout/`), wired into
`AppLayout.jsx` — the shared authenticated shell every admin/manager page
already renders through — right above `<Outlet />`, so it's visible
regardless of which page the block happens on. `AppLayout` already fetched
`Company` (for the sidebar's company name); this just also captures
`.status` and passes it down. Not shown to `super_admin` (platform role,
no `company_id`, never subject to this gate) or while status is still
loading. Links to `/gestion-licencias` (the existing `LicenseManagement`
page) rather than duplicating license detail in the banner itself.

**Gap found and fixed 2026-08-19 (independent re-verification audit):**
`AppLayout.jsx` has an earlier early-return branch, for the plain
`employee` role (which has no `NAV_BY_ROLE` entry — see the module-9-
adjacent comment in that file), that rendered a bare `<Outlet />` with
**no banner**. Employees are subject to the exact same `_billingGuard.ts`
write-gate as admin/manager roles (e.g. clocking in via
`updateAttendanceRecord`), so a blocked employee saw the same
unexplained generic error toast this banner exists to fix — just on the
one role path that mattered most (employees clock in far more often than
admins approve requests). Fixed by rendering `CompanyStatusBanner` in that
branch too, using the `companyStatus` state `AppLayout` already fetches
regardless of role.

**Verified:** `npm run lint`, `npm run build` pass. Not visually verified
against a live suspended/view_only company — not achievable in this
environment; risk is bounded since this only adds a new read-only display,
touching no write path.

## In-app version & changelog refresh (module 6, added 2026-08-18)

`src/pages/ChangeLog.jsx` existed but was a hardcoded array last updated
2026-07-28 — three weeks of real, verified fixes (the 2026-08-10 dependency
patch, this session's billing-gate/export/danger-zone work) were never
reflected in-app, even though `CHANGELOG.md` at the repo root was kept
current the whole time. New `src/lib/appConfig.js` (`APP_VERSION`/
`RELEASE_DATE`, mirroring the same file's role in stockflow/cateqhub/
puntos) now feeds a version stamp at the bottom of the changelog page, and
`CHANGES` got a new entry summarizing this session's actual changes.
`package.json`'s `version` bumped to `0.1.3` alongside a matching
`CHANGELOG.md` entry — kept in sync by hand, same as the rest of this
portfolio outside stockflow's automated release workflow; not attempting
to build a dedicated release script here since nothing in this repo's
`package.json`/CI suggests one was ever planned (same reasoning
`jospabloh/puntos`'s CLAUDE.md gives for not guessing at a release
pipeline that doesn't exist yet).

**Verified:** `npm run lint`, `npm run build` pass.

## Modules 2 and 3 — a real role declaration and a real permission system (2026-08-21)

A portfolio-standard re-audit found these were the two modules RADAR did not
have. Everything else was in place; these were genuinely absent, not
partially built.

### Module 2 — roles declared in one file

The four roles existed only as string literals scattered across
`AppLayout.jsx`, `CompanySettings.jsx`, `Approvals.jsx`, `Employees.jsx`,
`EmployeeProfile.jsx`, `AttendanceCalendar.jsx` and five backend functions —
with **three independent copies of the manager set** and **three of the label
map, already drifted**: `Employees.jsx` labelled `store_manager` "Store
Manager", `EmployeeProfile.jsx` "Gerente de tienda", and neither knew
`super_admin` existed.

New **`src/lib/rbac.js`** is now the only place a role is declared: `ROLES`,
`ROLE_LABELS`, `MANAGER_ROLES`, `TENANT_ROLES` and the `isSuperAdmin` /
`isCompanyAdmin` / `isManager` / `isEmployee` / `hasTenant` helpers. Every
client copy was replaced with an import. The file also states the Layer 1 /
Layer 2 separation explicitly, so nobody conflates these with Mission
Control's operator roles.

### Module 3 — granular permissions, enforced on both sides

Before this, RADAR had **no permission concept at all** beyond the role:
`MANAGER_ROLES.has(app_role)` was the entire answer, client and server. There
was no way for a `company_admin` to say "my store_managers may approve PTO but
may not export the company's data", and no key for anything to check.

- **`src/lib/permissionRegistry.js`** — 13 keys across Asistencias,
  Aprobaciones, Empleados, Horarios, Empresa and Soporte, each with a default
  per role, plus `resolvePermission()` documenting the precedence.
  `Soporte:*` is open to every role including `employee` on purpose: a person
  locked out of everything else still has to be able to say so, which is the
  same reason `updateSupportTicket` stays outside the billing gate.
- **`PermissionProfile` entity** — one sparse row per `(company_id,
  role_key)`, holding only the keys a company_admin explicitly overrode. Sparse
  matters: changing a registry default still reaches every tenant that never
  overrode it. RLS scopes writes to the caller's own company.
- **`src/lib/PermissionContext.jsx`** — `usePermissions().can(key)`, mounted in
  `App.jsx`. Fails **closed to the registry defaults**, not open: a failed
  `PermissionProfile` read yields the same answer the server computes when no
  override row exists.
- **Server-side re-check in all five write/export functions** —
  `resolveApprovalRequest` (`Aprobaciones:resolve`), `updateAttendanceRecord`
  (`Asistencias:edit`), `createManagedRecord` (`Horarios:manage` /
  `Empleados:propose_schedule`, via `ENTITY_PERMISSION` so a new managed entity
  cannot be added without choosing a key), `createEmployee`
  (`Empleados:create`, checked **before** `inviteUser` fires so a denied caller
  doesn't cause a real invitation email) and `exportCompanyData`
  (`Empresa:export_data`). Each is checked against the **record's own**
  `company_id`, never one from the request body.
- **`exportCompanyData` gets the permission check but deliberately no billing
  gate** — it is read-only, and a suspended tenant getting its data out is
  exactly the case the export exists for. Gating it would make the danger zone
  a trap.

### The copies, and why they can't drift

`_permissions.ts` follows the same "one colocated copy per function directory"
shape `_billingGuard.ts` already had (Deno can't import across function dirs),
but unlike `_billingGuard.ts` — whose header says "keep all copies identical;
regenerate by hand" — these are **generated and checked**:

- `base44/functions/_shared/_permissions.ts` is the canonical source;
- `npm run generate:function-permissions` fans it out to the five functions;
- `npm run validate:permissions` (wired into `npm run lint`) fails if the
  canonical file drifts from `permissionRegistry.js` **or** if any colocated
  copy differs from the canonical file byte-for-byte.

Confirmed both halves are real, not no-ops, by flipping one default and
watching each check fail before restoring it.

**Deploy note: this pass adds an entity.** `PermissionProfile.jsonc` must be
pushed (`npx base44 entities push`) — a repo `.jsonc` alone changes nothing at
runtime, and until it exists in the deployed schema every override read returns
nothing, which degrades to the registry defaults rather than breaking (the
fail-closed-to-defaults design above), so the ordering is safe either way.

**Verified:** `npm run lint` (eslint + `validate:rls` 15 entities, 13
tenant-scoped + `validate:permissions` 13 keys, 5 synced copies) and
`npm run build` both pass. `deno` still isn't available in this sandbox and
this repo's CI has no `deno lint`/`deno test` step — the five edited `entry.ts`
files were reviewed by hand, same caveat as the 2026-08-18 billing-gate pass.
**Not verified:** a browser session as a `store_manager` with an explicit
override. Risk is bounded: with no `PermissionProfile` row (i.e. every tenant
today) the new checks resolve to exactly the role defaults the previous
`MANAGER_ROLES` gate already enforced, with one deliberate tightening —
`Empleados:create` and `Horarios:manage` are now `company_admin`-only, where a
`store_manager` previously passed the coarse manager check.

## ACACIA Portfolio Standard

This app is part of the ACACIA portfolio and must stay compliant with
`jospabloh/acacia-app-standard`. Read `STANDARD.md` there before implementing
any item below for the first time, and re-read the relevant section before
touching a module that's already implemented.

- [x] Module 1 — License lifecycle: `Company.status`
      (active|view_only|suspended), written ONLY by Mission Control. No native
      lifecycle cron. The absence of a `trial` state is deliberate and
      documented above — RADAR is sales-led, with no self-serve signup to
      start a trial clock.
- [x] Module 2 — Roles declared once in `src/lib/rbac.js` (2026-08-21),
      mapped onto the `app_role` field. Mission Control's operator roles are a
      separate layer, never conflated.
- [x] Module 3 — Granular permissions: `src/lib/permissionRegistry.js` +
      `PermissionProfile` overrides + server-side re-check in all five
      write/export functions, behind `_billingGuard.ts`. Generated server
      copies, drift-checked in `npm run lint` (2026-08-21).
- [x] Module 4 — RLS: tenant branch + service-role admin branch on every
      `company_id` entity, `validate-entity-rls.mjs` blocking in lint.
- [x] Module 5 — Health: Mission Control polls `acaciaControl`'s `ping`.
- [x] Module 6 — `src/lib/appConfig.js` + `ChangeLog.jsx`.
- [x] Module 7 — `CompanySettings.jsx`: data export + deletion request routed
      through support (a tenant admin cannot delete their own company by RLS,
      by design).
- [x] Module 8 — `SupportCenter.jsx` writes `SupportTicket` here first, pushed
      by `notifyTicketCreated` and pulled by `acaciaControl`.
- [x] Module 9 — `apps/radar.html` on `jospabloh/acaciaco-site`.
- [x] Module 10 — Login on-brand with real error states;
      `CompanyStatusBanner` explains suspended/view_only post-login on every
      role path including the plain `employee` branch.

Last audited against the standard: 2026-08-21 — modules 2 and 3 were the only
open items; both closed in this pass.

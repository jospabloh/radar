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

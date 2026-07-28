# RADAR permissions matrix

Generated as part of the 2026-07-28 RADAR audit (three passes). Reflects
the RLS rules in `base44/entities/*.jsonc` **after** all three passes'
fixes, plus the five service-role functions that carry their own
authorization checks (`updateAttendanceRecord`, `resolveApprovalRequest`,
`createManagedRecord`, `createEmployee`, `updateSupportTicket`).

Roles are the app's business roles (`User.app_role` /
`Employee.role`): **employee**, **store_manager**, **company_admin**,
**super_admin**. `role: admin` inside an `.jsonc` `rls` block is a
*different* thing — Base44's service-role tier, used only by backend
functions via `asServiceRole`. No human account ever carries `role: admin`;
it is not a 5th business role.

Legend: **own** = scoped to the caller's own record (their `employee_id` /
`user_id`); **company** = any row in the caller's company; **fn** = only
reachable through a role-checked backend function, not a direct entity
write; **service only** = no client code writes this at all — reachable
only via `asServiceRole` from a backend function.

| Entity | Read | Create | Update | Delete |
|---|---|---|---|---|
| Company | company | fn (service only) | company (name/timezone/whatsapp_enabled); tier/max_employees/license_expiry/status: service only | service only |
| Employee | company | fn (`createEmployee`; company_admin/store_manager → own company, employee\|store_manager only; super_admin → any company, company_admin only) | service only | service only |
| User | own + company | service only | own | service only |
| AttendanceRecord | company | own | own | service only |
| ExtensionRequest | company | own | fn (manager-only, via `resolveApprovalRequest`) | service only |
| PTORequest | company | own | fn (manager-only, via `resolveApprovalRequest`) | service only |
| ScheduleChangeRequest | company | fn (manager-only, via `createManagedRecord`) | fn (manager-only, via `resolveApprovalRequest`; also writes `Employee.schedule`) | service only |
| ShiftTemplate | company | fn (manager-only, via `createManagedRecord`) | service only | fn (manager-only, via `createManagedRecord`) |
| Holiday | company | service only | service only | service only |
| EmployeeDocument | company | own | service only | service only |
| NotificationPreference | own + company (read only) | own | own | service only |
| SupportTicket | company | company + own identity (`created_by_id`) | fn (`updateSupportTicket`, company_admin only) | service only |
| SupportTicketMessage | company (excl. internal notes) | company + own identity (`author_id`) | service only | service only |
| AppSession | own | own | own (`revoked_at`/`revoked_by`: service only) | service only |

Every row above is now either scoped declaratively (own/company) or gated
by a role-checking backend function. No remaining ⚠️ gaps.

## What changed

### Pass 1 (self-approval / billing escalation)

- **Company** `tier`/`max_employees`/`license_expiry`/`status` field-locked
  to the service role — any employee could otherwise grant their own
  company an enterprise tier or clear a suspension directly, bypassing the
  `SupportTicket`-based upgrade flow `LicenseManagement.jsx` actually uses.
- **PTORequest / ScheduleChangeRequest / ExtensionRequest** `status` (and
  `PTORequest.manager_comment`) field-locked to the service role — any
  employee could approve or reject their own (or a coworker's) request
  directly, since neither the RLS nor `Approvals.jsx` had a manager-role
  check. Manager approve/reject now goes through `resolveApprovalRequest`
  (verifies `app_role`); `Approvals.jsx` also hides behind that same check.
- **User** `update` narrowed to self + service role (was self + *any
  same-company user* + service role) — closed an account-takeover path via
  editing another user's `email`.
- **NotificationPreference** `create`/`update` narrowed to owner + service
  role (was owner + any same-company user) — closed an IDOR that let a
  coworker silently disable your notifications.

### Pass 2 (remaining RLS-only gaps)

- **Employee** `update` is now service role only (was any same-company
  user, including the unlocked `role` field — self-promotion to
  `company_admin`). No client code updates `Employee` post-creation, so
  this closed the gap with no functional change.
- **PTORequest / ExtensionRequest** `create` narrowed to the caller's own
  `employee_id` (mirrors `AttendanceRecord`'s existing pattern) — closes
  request-spoofing (filing a request under a coworker's identity). `update`
  is now service-role only (no client caller remains after pass 1 moved
  approval into `resolveApprovalRequest`).
- **ScheduleChangeRequest** `create`/`update` are now service-role only.
  This entity is manager-initiated *for* another employee, so it can't be
  scoped to "own employee_id" like the two above — there's no declarative
  RLS way to require "caller is a manager", so creation now goes through
  the new `createManagedRecord` function (same `app_role` check as
  `resolveApprovalRequest`).
- **ShiftTemplate** `create`/`update` are now service-role only, routed
  through `createManagedRecord` for create. Its `delete` rule was *already*
  service-role only before this audit — meaning the delete button in
  `ShiftSettings.jsx` could never have worked for any real user. Fixed
  alongside the new gate: delete now also goes through
  `createManagedRecord`.
- **Holiday** `create`/`update` are now service-role only. No client code
  writes `Holiday` at all (it's a read-only, unbuilt-creation-UI feature
  today) — locked before any creation UI exists rather than after.
- **EmployeeDocument** `create` narrowed to the caller's own `employee_id`
  (`EmployeeProfile.jsx` always uploads to the caller's own record).
  `update` is now service-role only (unused client-side).
- **SupportTicket** `create` now also requires `data.created_by_id ==
  {{user.id}}`. Both client callers already set this correctly; this closes
  the gap for a direct SDK call spoofing another employee's identity.
- **SupportTicketMessage** `create` now also requires `data.author_id ==
  {{user.id}}`. No UI creates these yet (the messaging thread feature isn't
  built) — locked now, before it is.

### Pass 3 (the two gaps that needed new invite/role-check functions, plus code-quality findings)

- **Employee** `create` is now service role only, closing the last open
  gap: any same-company member could previously call `Employee.create`
  directly with `role: "company_admin"`. Both legitimate creators
  (`EmployeeFormDialog.jsx` for company_admin/store_manager,
  `SuperAdminCompanies.jsx` for super_admin cross-company admin invites)
  now go through the new `createEmployee` function, which validates the
  caller's `app_role`, restricts which role they may grant (manager path:
  employee/store_manager only; super_admin path: company_admin only, any
  company), and pins `company_id` accordingly before writing via
  `asServiceRole`. `base44.users.inviteUser` is still called with the
  caller's own client (unchanged privilege requirement, just moved
  server-side alongside the validation).
- **SupportTicket** `update` is now service role only, closing the last
  open gap: `SupportCenter.jsx` only *displayed* the status dropdown to
  `company_admin`, but the RLS had no matching role check, so a
  `store_manager` or `employee` calling `SupportTicket.update` directly
  would have succeeded. Status changes now go through the new
  `updateSupportTicket` function (company_admin only).
- **Sidebar navigation fixed**: 10 pages that are in `NAV_BY_ROLE` (and so
  reachable from the sidebar) were rendering outside `AppLayout`, making
  the sidebar disappear on click. Moved into the `AppLayout` route group in
  `App.jsx`. Five of those (calendario-asistencias,
  configuracion-notificaciones, manual-usuario, soporte,
  historial-cambios) are *also* linked from `EmployeePortal.jsx` for the
  plain `employee` role, which has no `NAV_BY_ROLE` entry — `AppLayout` now
  renders a bare `<Outlet/>` (no sidebar chrome) for that role, preserving
  the standalone/back-to-portal UX those pages already had, while
  admin/manager roles get the sidebar on every one of their destinations.
- **`base44.auth.me()` deduplicated**: ~18 files independently re-fetched
  the current user on mount instead of reading the already-resolved
  `AuthContext`. Replaced with `useAuth()` in all pages/components that
  render only after auth is resolved (everything under `ProtectedRoute`).
  Left `Onboarding.jsx` and `EmployeePortal.jsx` untouched — both have a
  legitimate reason to re-fetch fresh state (establishing `app_role` for
  the first time / backfilling `employee_id` via `completeOnboarding`),
  where a stale cached `user` could be actively wrong.
- **Error handling added** to CRUD mutations that previously had none:
  `Approvals.jsx`, `SuperAdminCompanies.jsx` (also fixed a stuck-`saving`
  bug — `setSaving(true)` had no matching `finally`), `CompanySettings.jsx`,
  `EmployeeProfile.jsx`, `LicenseManagement.jsx` (also fixed dead
  `requesting` state that was never actually set), `ShiftSettings.jsx`,
  `IncidentPanel.jsx`, `SupportCenter.jsx`, `NotificationSettings.jsx`,
  `EmployeeFormDialog.jsx`, `ScheduleChangeDialog.jsx`,
  `PTORequestDialog.jsx`, `ExtensionRequestDialog.jsx`. All now surface
  failures via the existing `useToast` pattern instead of failing silently.
- **Duplicated attendance-status label/color maps consolidated**:
  `CompanyDashboard.jsx` (full set) and `IncidentPanel.jsx` (absent/late
  subset) each independently declared the same map; moved to
  `ATTENDANCE_STATUS_STYLE`/`ATTENDANCE_STATUS_LABEL` in `src/lib/schedule.js`
  alongside `computeStatus`, which already lived there. (`MyRequests.jsx`'s
  PTO-status map and `SupportCenter.jsx`'s ticket-status map are each used
  in only one place — left as-is, not a real duplication.)
- **Dark-mode-unsafe hardcoded colors fixed**: `bg-purple-100
  text-purple-700` → `bg-accent text-accent-foreground` in
  `SuperAdminCompanies.jsx`, `Reports.jsx`, `AttendanceCalendar.jsx`;
  `SupportCenter.jsx`'s `STATUS_STYLE` switched from raw
  `bg-yellow-100`/`bg-blue-100`/etc. to semantic tokens; `PageNotFound.jsx`
  (a Base44 scaffold page, entirely hardcoded `slate`/`orange`) rewritten
  to use `background`/`foreground`/`muted`/`border`/`warning`/`ring`
  tokens throughout.
- **Redundant Company lookup removed** from `AppLayout.jsx` — it looked up
  the caller's `Employee` row just to read `company_id`, which is already
  present directly on `User`.

## Not touched (judgment calls, reasoning recorded)

- **Realtime-subscription inconsistency** (`CompanyDashboard.jsx` is the
  only page that calls `.subscribe()`; others poll on mount/action) — a
  product/consistency decision, not a bug, left alone.
- **`ShiftTemplate`/`Holiday`/`EmployeeDocument` read scope** stays
  company-wide rather than manager-scoped for `ShiftTemplate`/`Holiday` —
  reading a shift template or holiday isn't sensitive, and narrowing it
  further wasn't part of any concrete finding.
- **`scripts/validate-entity-rls.mjs`** still only checks structural shape,
  not whether a role check is actually required for an operation — every
  bug fixed across all three passes passed the guard script cleanly, by
  design (it wasn't built to catch missing *role* logic, only missing
  *tenant* logic). A follow-up lint rule for "mutates a `status`-like enum
  with no role condition and no field-level lock" would help, but risks
  false positives on legitimately self-service status fields (e.g.
  `AttendanceRecord.status` is self-set on check-in) if rushed — left for a
  dedicated pass.

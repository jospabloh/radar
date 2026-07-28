# RADAR permissions matrix

Generated as part of the 2026-07-28 RADAR audit (two passes). Reflects the
RLS rules in `base44/entities/*.jsonc` **after** both passes' fixes, plus
the three service-role functions that carry their own authorization checks
(`updateAttendanceRecord`, `resolveApprovalRequest`, `createManagedRecord`).

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
| Employee | company | company ⚠️ | service only | service only |
| User | own + company | service only | own | service only |
| AttendanceRecord | company | own | own | service only |
| ExtensionRequest | company | own | fn (manager-only, via `resolveApprovalRequest`) | service only |
| PTORequest | company | own | fn (manager-only, via `resolveApprovalRequest`) | service only |
| ScheduleChangeRequest | company | fn (manager-only, via `createManagedRecord`) | fn (manager-only, via `resolveApprovalRequest`; also writes `Employee.schedule`) | service only |
| ShiftTemplate | company | fn (manager-only, via `createManagedRecord`) | service only | fn (manager-only, via `createManagedRecord`) |
| Holiday | company | service only | service only | service only |
| EmployeeDocument | company | own | service only | service only |
| NotificationPreference | own + company (read only) | own | own | service only |
| SupportTicket | company | company + own identity (`created_by_id`) | company_admin only (app-level `isAdmin` check in `SupportCenter.jsx`, not RLS) ⚠️ | service only |
| SupportTicketMessage | company (excl. internal notes) | company + own identity (`author_id`) | service only | service only |
| AppSession | own | own | own (`revoked_at`/`revoked_by`: service only) | service only |

⚠️ = known gap, not fixed — see "Known gaps" below.

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

### Pass 2 (remaining known gaps, all closed)

- **Employee** `update` is now service role only (was any same-company
  user, including the unlocked `role` field — self-promotion to
  `company_admin`). No client code updates `Employee` post-creation, so
  this closes the gap with no functional change. `create` is intentionally
  left open (see Known gaps #1) — locking it would require rebuilding the
  `base44.users.inviteUser`-based invite flow behind a service-role
  function, which needs a live backend to test.
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

## Known gaps (still open)

1. **Employee.role at create time.** An admin/manager can still set any
   `role` value (including `company_admin`) when creating an employee via
   `EmployeeFormDialog.jsx` — and per current RLS, so could any other
   same-company member calling `Employee.create` directly, since `create`
   isn't role-gated either (unchanged from before this audit — it was never
   the specific bug found, which was about *escalating an existing row*).
   Closing this fully needs a `createEmployee` service-role function that
   also drives `base44.users.inviteUser`, which this sandbox has no live
   Base44 backend to test against — a wrong implementation here would break
   employee onboarding. Left as a follow-up with a real test environment.
2. **SupportTicket update role gate lives in the client, not RLS.**
   `SupportCenter.jsx` checks `app_role === "company_admin"` before showing
   status controls, but the RLS `update` rule itself is still company-wide.
   A `store_manager` or `employee` calling `SupportTicket.update` directly
   could still change ticket status. Lower priority than the fixed items
   (tickets are ACACIA-support-facing, not tenant-sensitive data), but
   should eventually get the same `resolveApprovalRequest`-style treatment.
3. **`scripts/validate-entity-rls.mjs` only checks structural shape** (rls
   block presence, `data.`/`{{user.data.*}}` prefixes, the service-role
   branch), not whether a role check is actually required for an
   operation. Every bug fixed in this audit passed the guard script
   cleanly — it cannot see this class of bug by design. A follow-up lint
   rule for "mutates a `status`-like enum with no role condition and no
   field-level lock" would help, but needs care to avoid false positives on
   legitimately self-service status fields (e.g. `AttendanceRecord.status`
   is self-set on check-in).

## Also flagged, not RLS-fixable (separate audit findings, unchanged)

- A broken sidebar-nav/route mismatch: 10 of the app's pages render outside
  `AppLayout` (the sidebar disappears when you navigate to them).
- `base44.auth.me()` is independently re-fetched in ~20 files instead of
  reading the already-available `AuthContext`.
- Inconsistent error handling on mutations (roughly half the app's CRUD
  pages have no `try/catch` at all).
- A handful of hardcoded, dark-mode-unsafe Tailwind colors.

These are real but are refactor-scale UI changes, not permission bugs, and
this sandbox has no live Base44 backend to click through the running app
and verify a refactor didn't regress something. Left for a pass with a
real test environment.

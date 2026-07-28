# RADAR permissions matrix

Generated as part of the 2026-07-28 RADAR audit. Reflects the RLS rules in
`base44/entities/*.jsonc` **after** that audit's fixes, plus the two
service-role functions that carry their own authorization checks
(`updateAttendanceRecord`, `resolveApprovalRequest`).

Roles are the app's business roles (`User.app_role` /
`Employee.role`): **employee**, **store_manager**, **company_admin**,
**super_admin**. `role: admin` inside an `.jsonc` `rls` block is a
*different* thing — Base44's service-role tier, used only by backend
functions via `asServiceRole`. No human account ever carries `role: admin`;
it is not a 5th business role.

Legend: **own** = scoped to the caller's own record (their `employee_id` /
`user_id`); **company** = any row in the caller's company; **-** = not
permitted via RLS (only reachable through a gated backend function, or not
reachable at all); **fn** = only reachable through a role-checked backend
function, not a direct entity write.

| Entity | Read | Create | Update | Delete |
|---|---|---|---|---|
| Company | company | fn (service only) | company (name/timezone/whatsapp_enabled); **tier/max_employees/license_expiry/status: fn (service only)** | service only |
| Employee | company | company ⚠️ | company, incl. `role` ⚠️ | service only |
| User | own + company | service only | own | service only |
| AttendanceRecord | company | own | own | service only |
| ExtensionRequest | company | company ⚠️ | own (status: **fn**, manager-only) | service only |
| PTORequest | company | company ⚠️ | own (status/manager_comment: **fn**, manager-only) | service only |
| ScheduleChangeRequest | company | company ⚠️ | own (status: **fn**, manager-only; approval also writes `Employee.schedule` via fn) | service only |
| ShiftTemplate | company | company | company | service only |
| Holiday | company | company | company | service only |
| EmployeeDocument | company | company ⚠️ | company ⚠️ | service only |
| NotificationPreference | own + company (read only) | own | own | service only |
| SupportTicket | company | company (author fields client-set, not RLS-enforced ⚠️) | company_admin only (app-level `isAdmin` check in `SupportCenter.jsx`, not RLS) | service only |
| SupportTicketMessage | company (excl. internal notes) | company (author fields client-set, not RLS-enforced ⚠️) | service only | service only |
| AppSession | own | own | own (`revoked_at`/`revoked_by`: service only) | service only |

⚠️ = known gap, not fixed in this pass — see "Known gaps" below. Everything
else in this table reflects the state after this audit's fixes.

## What changed in this audit

- **Company** `tier`/`max_employees`/`license_expiry`/`status` are now
  field-locked to the service role. Previously any employee could call
  `Company.update` on their own company and grant themselves an enterprise
  tier or clear a suspension directly — bypassing the
  `SupportTicket`-based upgrade-request flow that `LicenseManagement.jsx`
  actually uses.
- **PTORequest / ScheduleChangeRequest / ExtensionRequest** `status` (and
  `PTORequest.manager_comment`) are now field-locked to the service role.
  Previously any employee could approve or reject their own (or a
  coworker's) request directly — the RLS had no manager/admin role check at
  all, and `Approvals.jsx` had no client-side role check either. Manager
  approve/reject now goes through the new `resolveApprovalRequest`
  function, which verifies `app_role` is `company_admin` / `store_manager`
  / `super_admin` before writing. The approvals page itself now also hides
  behind an `app_role` check so non-managers don't see a UI that would be
  rejected server-side.
- **User** `update` no longer has a company-wide branch. Previously any
  user in a company could write to *any other* user's row in that company,
  including unlocked fields like `email` — a path to account takeover via
  a subsequent password reset. Self-service update only.
- **NotificationPreference** `create`/`update` no longer have a
  company-wide branch (an IDOR that let a coworker silently disable your
  approval/incident notifications). `read` keeps it, per the RLS guard's
  requirement that a tenant-scoped entity's read stay company-visible, and
  because reading a toggle state is materially lower risk than writing it.

## Known gaps (flagged, not fixed this pass)

These need either a new service-role function (same shape as
`resolveApprovalRequest`) or product input on intended behavior, and
touch onboarding/creation flows this sandbox has no way to exercise
end-to-end against a live Base44 backend — flagging for a follow-up pass
with proper testing rather than risking a blind break:

1. **Employee.role escalation.** `Employee.update` has no role gate, so any
   employee could set their own or a coworker's `Employee.role` to
   `company_admin`. Today's authorization decisions all key off
   `User.app_role` (which *is* locked), so this is currently inert, but
   any future feature that trusts `Employee.role` would silently inherit
   the hole.
2. **Request create-side spoofing.** `PTORequest` / `ScheduleChangeRequest`
   / `ExtensionRequest` `create` only checks `data.company_id`, not
   `data.employee_id` against the caller (unlike `AttendanceRecord`, which
   was hardened for exactly this in an earlier audit). An employee could
   file a request under a coworker's name. Lower severity than the
   self-approval bug fixed above — it creates a fraudulent *pending*
   request, it doesn't grant approval — but should be closed the same way
   AttendanceRecord was.
3. **SupportTicket / SupportTicketMessage author-identity spoofing.**
   `created_by_id`/`author_id`/`author_role` are client-set, not RLS-locked
   to the caller. Current app code always sets them correctly, but nothing
   stops a direct SDK call from spoofing another employee or an
   `owner`-role support-agent reply within the caller's own tenant.
4. **EmployeeDocument / ShiftTemplate / Holiday** stay company-wide
   writable rather than owner- or manager-scoped. Business-trust-model
   dependent (e.g. should any coworker be able to upload to *your*
   employee file?) — needs a product decision, not a unilateral RLS
   change.
5. **`scripts/validate-entity-rls.mjs` only checks structural shape**
   (rls block presence, `data.`/`{{user.data.*}}` prefixes, the
   service-role branch), not whether a role check is actually required
   for an operation. Every bug fixed in this audit passed the guard
   script cleanly — it cannot see this class of bug by design. Worth a
   follow-up to add a lint rule for "mutates a `status`-like enum with no
   role condition and no field-level lock," but that needs care to avoid
   false positives on legitimately self-service status fields.

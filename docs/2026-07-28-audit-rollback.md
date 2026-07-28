# Rollback notes — 2026-07-28 security audit

If any of these fixes cause an unexpected regression after deploy, here is
how to undo each one independently (they don't depend on each other).

## 1. Company billing/license field lock

Revert the `rls.write` block on `tier`/`max_employees`/`license_expiry`/
`status` in `base44/entities/Company.jsonc` back to having no per-field
`rls` (inherits the entity-level `update` rule). No other file changed.

## 2. Request self-approval fix (PTORequest / ScheduleChangeRequest / ExtensionRequest)

Three parts, revert together:
- Remove the per-field `rls` lock on `status` (and `PTORequest.manager_comment`)
  in the three `.jsonc` files.
- Revert `src/pages/Approvals.jsx` to call `base44.entities.<X>.update(id, {status})`
  directly instead of `base44.functions.invoke("resolveApprovalRequest", ...)`,
  and drop the `isManager` gate.
- Delete `base44/functions/resolveApprovalRequest/` (or leave it — unused
  functions are inert, no need to remove it to roll back the RLS/UI side).

## 3. User update narrowing

Restore the `{"data.company_id": "{{user.data.company_id}}"}` branch to
`User.jsonc`'s `update` rule. No other file changed.

## 4. NotificationPreference write narrowing

Restore the `{"data.company_id": "{{user.data.company_id}}"}` branch to
`create` and `update` in `NotificationPreference.jsonc` (it was already
kept in `read`). No other file changed.

## 5. Dependency patch (`npm audit fix`)

`package-lock.json` only — no `package.json` version ranges changed
(all bumps stayed within existing semver ranges). Revert with
`git checkout <prior-commit> -- package-lock.json && npm install`, or just
run `npm install` against the pre-audit lockfile.

## 6. Employee update lock

Restore the `{"$or":[{"data.company_id":"{{user.data.company_id}}"},
{"user_condition":{"role":"admin"}}]}` branch to `Employee.jsonc`'s
`update` rule. No other file changed (nothing in `src/` writes
`Employee.update`, so nothing else needs to change to keep working).

## 7. PTORequest / ExtensionRequest create + update narrowing

Per entity: restore `create`'s `$or` to a plain
`{"data.company_id":"{{user.data.company_id}}"}` branch (drop the
`employee_id` `$and`), and restore `update` to the same
company-wide-plus-admin `$or` it had after pass 1. No client file changed
in this step, so no other revert needed.

## 8. ScheduleChangeRequest / ShiftTemplate service-role lock + createManagedRecord

Four parts, revert together per entity:
- Restore `ScheduleChangeRequest.jsonc`'s `create`/`update` to the
  company-wide-plus-admin `$or` rule.
- Restore `ShiftTemplate.jsonc`'s `create`/`update` to the same shape
  (`delete` was already service-role only before this audit — leave it).
- Revert `src/components/employees/ScheduleChangeDialog.jsx` to call
  `base44.entities.ScheduleChangeRequest.create(...)` directly.
- Revert `src/pages/ShiftSettings.jsx`'s `handleCreate`/`handleDelete` to
  call `base44.entities.ShiftTemplate.create`/`.delete` directly (note:
  reverting `handleDelete` un-fixes the pre-existing broken delete button —
  it will go back to silently failing for every real user, since `delete`
  was already service-role only beforehand).
- Delete `base44/functions/createManagedRecord/` (optional — inert if
  unused).

## 9. SupportTicket / SupportTicketMessage author-identity binding

Remove the `data.created_by_id`/`data.author_id` equality check from each
entity's `create` `$and`. No client file changed.

## 10. EmployeeDocument create/update narrowing

Restore `create`'s `$or` to a plain `data.company_id` branch (drop the
`employee_id` `$and`), and restore `update` to the company-wide-plus-admin
`$or`. No client file changed.

## 11. Holiday create/update lock

Restore `create`/`update` to the company-wide-plus-admin `$or` rule. No
client file changed (nothing writes `Holiday` either way).

## 12. Employee create lock + createEmployee

Three parts, revert together:
- Restore `Employee.jsonc`'s `create` rule to the company-wide-plus-admin
  `$or` it had before (same shape as the old `update` rule).
- Revert `src/components/employees/EmployeeFormDialog.jsx`'s `handleSubmit`
  to call `base44.users.inviteUser` then `base44.entities.Employee.create`
  directly (both must come back — the function currently does both).
- Revert `src/pages/SuperAdminCompanies.jsx`'s `inviteAdmin` the same way,
  restoring `role: "company_admin"` and `company_id: showInvite.id` as
  direct create-payload fields.
- Delete `base44/functions/createEmployee/` (optional — inert if unused).

## 13. SupportTicket update lock + updateSupportTicket

Two parts, revert together:
- Restore `SupportTicket.jsonc`'s `update` rule to the company-wide-plus-admin
  `$or` it had before.
- Revert `src/pages/SupportCenter.jsx`'s `handleStatusChange` to call
  `base44.entities.SupportTicket.update(id, {status})` directly.
- Delete `base44/functions/updateSupportTicket/` (optional).

## 14. Sidebar nav / AppLayout changes

Pure UI, no RLS involved, safe to revert independently:
- In `src/App.jsx`, move the 10 routes back out of the `<Route
  element={<AppLayout />}>` group to standalone `<Route>` entries (see git
  history for the pre-fix list).
- In `src/components/layout/AppLayout.jsx`, remove the `if (user &&
  !NAV_BY_ROLE[user.app_role])` bare-`<Outlet/>` branch.

## 15. auth.me() → useAuth() dedup, error-handling additions, color/map consolidation

These are independent, low-risk, additive changes (no RLS involved) spread
across ~20 files — revert per-file via git if any one causes an issue; there
is no cross-file dependency between them. `src/lib/schedule.js`'s
`ATTENDANCE_STATUS_STYLE`/`ATTENDANCE_STATUS_LABEL` exports are additive
(nothing removed), so reverting `CompanyDashboard.jsx`/`IncidentPanel.jsx`
to their own inline copies doesn't require touching `schedule.js`.

## Deploy note (applies to all of the above)

Per `AGENTS.md`/this repo's Base44 workflow: committing these `.jsonc`/
function changes to the repo does **not** change anything at runtime —
someone with Base44 CLI/dashboard access still needs to run the publish
step (`base44 dashboard open` or the CLI publish flow) for the RLS changes
and the new backend functions (`resolveApprovalRequest`,
`createManagedRecord`, `createEmployee`, `updateSupportTicket`) to take
effect against the live backend. This session had no authenticated Base44
CLI/MCP session available, so that deploy step could not be performed
here. **Deploy every new/changed function before the schema changes that
lock the fields they replace** (same reasoning as this repo's existing
`completeOnboarding` deploy-order note) — otherwise the affected writes
silently no-op for a window between the two deploys. Suggested order:
1. Deploy all five functions (`updateAttendanceRecord` already live;
   `resolveApprovalRequest`, `createManagedRecord`, `createEmployee`,
   `updateSupportTicket` are new).
2. Deploy the schema (`base44/entities/*.jsonc`).
3. Publish the frontend (the client code already calls the new functions).

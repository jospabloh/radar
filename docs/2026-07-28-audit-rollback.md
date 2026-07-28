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

## Deploy note (applies to all of the above)

Per `AGENTS.md`/this repo's Base44 workflow: committing these `.jsonc`/
function changes to the repo does **not** change anything at runtime —
someone with Base44 CLI/dashboard access still needs to run the publish
step (`base44 dashboard open` or the CLI publish flow) for the RLS changes
and the new `resolveApprovalRequest` function to take effect against the
live backend. This session had no authenticated Base44 CLI/MCP session
available, so that deploy step could not be performed here.

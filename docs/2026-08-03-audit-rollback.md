# RADAR audit + rollback notes — 2026-08-03

Fourth RADAR pass (after the three 2026-07-28 passes recorded in
`docs/2026-07-28-audit-rollback.md`, which are **not** superseded — read
that file too). This pass's scope: re-verify no regression in the prior
RLS work, run the release-readiness routine (CI, changelog, version,
permissions-matrix reconciliation), and investigate the specific new areas
called out for this run (WhatsApp check-in spoofing, Stripe/license-trial
flow, CI/dependency posture).

Branch: `claude/relaxed-rubin-242u1i`. Pre-audit tip (this branch, equal to
`main` at the time): `a61e5a1`. This doc is written before the audit
commit(s) land on the branch — see `git log claude/relaxed-rubin-242u1i`
for the exact commit SHA(s) this pass produced; the PR description also
lists them. PII/attendance data is in scope for this app, so this doc is
extra-conservative: every change below can be reverted independently, and
none of them depend on each other.

## Executive summary

No regression found in any of the five previously-merged security fixes
(PRs #5-#10) — every entity `.jsonc` file, every service-role function, and
every route/role check in `src/` was re-read and re-checked against
`docs/permissions-matrix.md`. One new, real finding was fixed
(`EmployeeDocument` read scope — see below); one defense-in-depth gap was
fixed (missing route-level role gate); the rest of the routine's checklist
(WhatsApp spoofing, Stripe/license-trial flow) turned out to be **not
applicable** — neither feature exists in this codebase as described, which
is itself documented below rather than silently skipped. Release-readiness
gaps (no CHANGELOG, no version bump, no CI) are now closed.

## Findings by severity

Every finding ends in one of: Fixed / Not reproducible / False positive /
Accepted risk / Deferred with issue / Blocked, per the audit routine's
requirement.

### Critical / High

None found this pass.

### Medium

1. **`EmployeeDocument.read` was company-wide, not owner-scoped — PII
   exposure.** Any signed-in member of a company could read any coworker's
   uploaded personal documents (ID, contracts — `EmployeeDocument.name`/
   `file_url`) by calling `entities.EmployeeDocument.filter({employee_id:
   <someone else's id>})` directly; the only client reader
   (`EmployeeProfile.jsx`) always scoped to the caller's own record, so RLS
   was wider than anything legitimate needed.
   **Status: Fixed.** `base44/entities/EmployeeDocument.jsonc` `read`
   narrowed to `data.employee_id == {{user.data.employee_id}}` (mirrors the
   existing `create` rule shape) plus the service-role branch.
   `npm run validate:rls` still passes (14 entities, 12 tenant-scoped).
   **Not yet deployed** — see "Deploy note" below.

2. **No CI at all before this pass.** Five prior security-fix PRs merged on
   local/manual verification only.
   **Status: Fixed.** Added `.github/workflows/ci.yml` (lint + build +
   `validate:rls` blocking; typecheck + `npm audit` informational — see
   next findings for why those two aren't blocking yet).

3. **No CHANGELOG, version stuck at `0.0.0` after 5 merged fix rounds.**
   **Status: Fixed.** Added `CHANGELOG.md`, bumped `package.json` to
   `0.1.0` (first versioned release; no prior scheme existed to follow).

### Low

4. **Admin/manager pages had no route-level role check** — any
   authenticated admin/manager-tier user could reach a page not in their
   own sidebar by typing its URL directly (e.g. a `store_manager` hitting
   `/gestion-licencias`). Checked every such page's actual reads/writes:
   entity RLS and the manager-only service-role functions
   (`createEmployee`, `resolveApprovalRequest`, `createManagedRecord`,
   `updateSupportTicket`) already blocked the underlying operations in
   every case — this was a UI-reachability gap, not a data exposure.
   **Status: Fixed** (defense in depth). `src/components/layout/AppLayout.jsx`
   now redirects to the caller's role's first `NAV_BY_ROLE` destination
   when the current route isn't in that role's list.

5. **Unused dependencies carrying supply-chain/vuln surface for no
   functional benefit**: `@stripe/react-stripe-js`, `@stripe/stripe-js`
   (zero imports anywhere — see "WhatsApp / Stripe" section below), and
   `react-quill` (zero imports; its `quill` transitive dependency carried a
   moderate XSS advisory — https://github.com/advisories/GHSA-4943-9vgg-gr5r).
   **Status: Fixed.** All three removed via `npm uninstall`; `package.json`/
   `package-lock.json` updated.

6. **`npm audit`: 1 high (`brace-expansion` ReDoS) + 1 moderate
   (`react-router`/`react-router-dom` — open redirect / deserialize-errors
   advisories) after removing the packages above.**
   **Status:** `brace-expansion` and the *patchable* part of the
   react-router advisory: **Fixed** via `npm audit fix` (non-breaking,
   stayed within the existing `^6.26.0` semver range).
   The residual `react-router-dom` moderate advisory
   (https://github.com/advisories/GHSA-wrjc-x8rr-h8h6,
   https://github.com/advisories/GHSA-337j-9hxr-rhxg) only clears on a
   6→7 major version, which is a routing-API migration, not a patch.
   **Status: Deferred with issue** — recommend a dedicated PR to migrate
   `react-router-dom` v6→v7 and re-test all routes/redirects, rather than
   bundling a breaking dependency migration into a security-audit pass.
   Current `npm audit` output (2 moderate remaining) is captured in this
   PR's CI run for reference.

### Not applicable (investigated per this run's specific checklist, no gap found)

7. **"WhatsApp check-in/out spoofing"** — investigated
   `base44/functions/attendanceMonitor/entry.ts` and
   `base44/workflows/AttendanceMonitor.jsonc` closely, plus grepped the
   whole repo for any WhatsApp Business API / Twilio / Meta Graph API
   integration or inbound webhook.
   **Status: Not reproducible / false premise** — no such feature exists.
   `attendanceMonitor` is a `*/15 * * * *` cron with **no client-supplied
   input at all** (`Deno.serve` handler takes no request body; it iterates
   `Company`/`Employee` itself via `asServiceRole`), so there is nothing to
   spoof. `Company.whatsapp_enabled` / `NotificationPreference.whatsapp_enabled`
   are notification-channel toggles, not a check-in mechanism. The actual
   check-in/out path is the authenticated web app
   (`src/pages/EmployeePortal.jsx`), which writes `AttendanceRecord.create`/
   `.update` — confirmed the RLS (`base44/entities/AttendanceRecord.jsonc`)
   requires **both** `data.company_id` and `data.employee_id` to match the
   caller's own `{{user.data.*}}` fields (not trusted from the client
   payload), which already closes any spoofing path. This matches PR #7's
   2026-07-23 fix and shows no regression.

8. **"Stripe license/trial flow"** — checked `package.json` (had
   `@stripe/react-stripe-js`/`@stripe/stripe-js`) and grepped `src/` and
   `base44/` for any usage.
   **Status: Not reproducible / false premise** — zero usages found
   anywhere. `src/pages/LicenseManagement.jsx`'s upgrade flow creates a
   `SupportTicket` (`category: "billing"`) that a human reviews; there is
   no payment form, no card-data handling, no Stripe SDK initialization
   anywhere in this app. The packages were dead weight (see finding 5,
   removed) — likely leftover Base44 scaffold dependencies, never wired up.
   This also matches the ACACIA portfolio's documented payments policy
   (Mercado Pago only, Stripe not used anywhere).

### Re-verified, no regression (no action needed)

- Every `base44/entities/*.jsonc` file still has an `rls` block; every
  tenant-scoped entity's read/write rules still carry both the tenant
  equality and the service-role branch (`npm run validate:rls` passes: 14
  entities, 12 tenant-scoped, 0 errors).
- `Company` billing-field lock (`tier`/`max_employees`/`license_expiry`/
  `status` → service-role only), all three approval entities'
  service-role-only `status` field, `Employee` create/update service-role
  lock + `createEmployee` function, `User` field locks +
  `completeOnboarding`, `SupportTicket`/`SupportTicketMessage` identity
  binding, `AppSession` field locks — all read back exactly as
  `docs/permissions-matrix.md` describes them, all still enforced.
- Every service-role function (`resolveApprovalRequest`,
  `createManagedRecord`, `createEmployee`, `updateSupportTicket`,
  `updateAttendanceRecord`, `acaciaControl`, `notifyTicketCreated`)
  re-read line by line: manager-role checks present and correct, tenant
  checks present and correct (`record.company_id !== user.company_id` guard
  before every service-role write on someone else's record),
  `acaciaControl`'s HMAC signature check uses a timing-safe comparison and
  a 5-minute freshness window, `notifyTicketCreated`/`acaciaControl`'s
  email helpers reject CR/LF header injection. No hardcoded secrets found
  anywhere in `src/`, `base44/`, or `scripts/` (grepped for common
  key/secret/password patterns).

## Code quality review

- No broken imports (`npm run lint` and `npm run build` both pass clean).
- No dead code beyond the three unused dependencies above (no unused
  exports/components found; `eslint-plugin-unused-imports` reports 0).
- No oversized app-specific components — largest is `SupportCenter.jsx` at
  282 lines; the only files over 300 lines are vendored shadcn/ui
  primitives (`sidebar.jsx`, `chart.jsx`), not app code.
- No duplicated logic found beyond what pass 3 already consolidated
  (attendance-status maps in `src/lib/schedule.js`).
- Error/loading/empty states: spot-checked `EmployeeProfile.jsx`,
  `EmployeePortal.jsx`, `LicenseManagement.jsx`, `SuperAdminCompanies.jsx` —
  all have loading guards and either a toast or an inline empty state; this
  matches pass 3's error-handling sweep, no gaps found.
- Mobile layout: code-level check only (see "Validated flows" below) —
  `AppLayout.jsx` has a `Sheet`-based mobile drawer with its own nav list;
  `EmployeePortal.jsx` uses a `max-w-sm` mobile-first column layout; no
  fixed-width elements found that would overflow on a small viewport.
- No unsafe assumptions about current user/company/role/license state found
  beyond what's already fixed (every page checked either uses `useAuth()`
  post-auth-resolution or the one-time `completeOnboarding`/`EmployeePortal`
  re-fetch pattern pass 3 documented as intentional).
- No TODO/FIXME/XXX markers left in `src/` or `base44/`.

## Checks run and results

| Check | Result |
|---|---|
| `npm install` | Needed (node_modules wasn't present); succeeded. `.npmrc` has a 7-day supply-chain cooldown (`min-release-age=7`) — respected automatically by `npm install`/`npm audit fix`. |
| `npm run lint` | **Pass**, 0 errors. |
| `npm run build` | **Pass**. Output: `dist/assets/index-*.js` ~1.02 MB (302 KB gzip) — one chunk-size warning from Vite (pre-existing, not caused by this pass; no code-splitting was in scope). |
| `npm run typecheck` | **Fails — pre-existing, unrelated to this pass.** 236 `tsc` errors, all JSX prop-type mismatches (e.g. `Register.jsx`, `Reports.jsx`, `ResetPassword.jsx`, `ShiftSettings.jsx`, `SuperAdminCompanies.jsx`, `SupportCenter.jsx`, `UserManual.jsx`) against untyped shadcn/ui components under `checkJs: true`. None of these files were touched by this pass or any of the five prior merged PRs' diffs at a level that would explain the error count — this is baseline debt, not a regression. Recommend a dedicated typecheck-cleanup pass (likely: add minimal JSDoc/prop-types to the shared `components/ui/*` primitives, or scope `jsconfig.json`'s `include` more narrowly) rather than bundling ~236 unrelated fixes into a security audit. Added to CI as informational (non-blocking) so it's visible going forward without blocking every PR. |
| `npm run validate:rls` | **Pass.** 14 entities, 12 tenant-scoped, 0 errors — both before and after this pass's `EmployeeDocument.jsonc` change. Per the script's own doc comment (and confirmed by reading `scripts/lib/entity-rls-rules.mjs` in full before relying on it), this validates **structural shape only**: that entity-field keys use the `data.` prefix, that user templates use `{{user.data.*}}` for custom fields, that every tenant-scoped entity has a `rls` block with the tenant-equality + service-role branches on read and the service-role branch on every write op. It does **not** verify that the role-check *logic* inside a service-role function is correct, or that a field ought to be locked in the first place — that verification was done by hand (reading every `.jsonc` file and every function) in this pass, as it was in passes 1-3. |
| GitHub Actions CI | **Did not exist before this pass.** Added `.github/workflows/ci.yml` (see finding 2). Not yet run on this repo's Actions tab as of writing this doc — it will run on the push that opens this PR. |
| `npm audit` | 5 vulnerabilities before (4 moderate, 1 high) → 2 moderate after (`brace-expansion`/router-open-redirect fixed by `npm audit fix`; `quill` XSS fixed by removing the unused `react-quill`; residual `react-router-dom` moderate deferred — see finding 6). |
| Base44 live schema verification | **Blocked.** The Base44 MCP server requires OAuth and returned "requires authentication before tools can be used" in this non-interactive session — `list_entity_schemas` and all other live Base44 API calls were unavailable. This pass could **only** verify the repo's `.jsonc` files, not whether the deployed backend schema actually matches them. Per this repo's own established pattern (see the Deploy note in `docs/2026-07-28-audit-rollback.md`), a `.jsonc` change alone does not affect the live app until someone with Base44 CLI/dashboard access runs the publish step. **This is the single largest open risk from this pass**: the `EmployeeDocument.read` fix (finding 1) is committed to the repo but not confirmed live. |

## Validated flows (code-level only — this session cannot run the app end-to-end; no Base44 dev backend was reachable)

All of the below are **static/code-reading validation**, not live/runtime
testing:

- **Login/session/company/role resolution**: read `AuthContext.jsx`,
  `ProtectedRoute.jsx`, `completeOnboarding/entry.ts`, `AppLayout.jsx`. Flow
  is: Base44 auth → `checkUserAuth()` populates `user` → `app_role`/
  `company_id`/`employee_id` come only from `completeOnboarding` (service
  role), never client-writable (see `User.jsonc` field locks). Confirmed
  sound, no regression.
- **WhatsApp check-in/out**: see finding 7 — not a real feature; actual
  check-in/out (`EmployeePortal.jsx`) confirmed correctly scoped.
- **Dashboard, shift templates, PTO/extension/schedule-change requests,
  employee documents, holidays, notification preferences**: each entity's
  RLS re-read against its only client caller(s) in `src/`; every write path
  either matches the caller's own identity or goes through a manager-role-
  checked service function. `EmployeeDocument` read was the one gap (fixed).
- **Role boundaries**: `NAV_BY_ROLE` in `AppLayout.jsx` now enforced at the
  route level too (finding 4); every manager-only service function
  independently re-checks `app_role` server-side regardless of what the
  client UI shows.
- **License/Stripe banner**: `LicenseManagement.jsx` read in full — no
  Stripe involved (finding 8); usage bar and plan cards read `Company`/
  `Employee` counts correctly scoped by existing RLS.
- **Mobile layout**: code-level review only (see Code quality review
  above) — no live-device or responsive-breakpoint testing was performed.

None of the above were executed against a running app or a real Base44
backend in this session.

## Files changed this pass

- `base44/entities/EmployeeDocument.jsonc` — `read` RLS narrowed (finding 1).
- `src/components/layout/AppLayout.jsx` — route-level role gate added
  (finding 4).
- `.github/workflows/ci.yml` — new (finding 2).
- `CHANGELOG.md` — new (finding 3).
- `package.json` — version `0.0.0` → `0.1.0`; removed
  `@stripe/react-stripe-js`, `@stripe/stripe-js`, `react-quill` (findings
  3, 5).
- `package-lock.json` — reflects the dependency removal + `npm audit fix`
  (findings 5, 6).
- `docs/permissions-matrix.md` — reconciled, pass 4 section added.
- `docs/2026-08-03-audit-rollback.md` — this file.

`src/pages/UserManual.jsx` already existed (added in pass 3, 2026-07-28)
and was reviewed for tenant-neutrality — confirmed clean (no company names,
phone numbers, or internal debug detail), linked from both `NAV_BY_ROLE`
(company_admin/store_manager) and `EmployeePortal.jsx`'s quick links
(employee). No changes needed; the routine's "create one if genuinely
absent" step did not apply.

## Rollback instructions

Every change below is independent — revert any subset without affecting
the others. `docs/2026-07-28-audit-rollback.md` covers everything from the
three prior passes and is unaffected by any of this.

### Whole-PR rollback

Once merged: `git revert -m 1 <merge-commit-sha>` (find the SHA on the PR
page or via `git log --oneline main`). Before merge: simply don't merge the
PR — the branch `claude/relaxed-rubin-242u1i` can be deleted or left as-is,
`main` is untouched until merge.

### Per-change rollback

1. **`EmployeeDocument.read` narrowing** — revert
   `base44/entities/EmployeeDocument.jsonc` to restore the plain
   `{"data.company_id":"{{user.data.company_id}}"}` `read` branch (drop the
   `$and`/`employee_id` check). No client file changed, so nothing else
   needs to change to keep the app working — this only widens who can read,
   never breaks a legitimate read.
2. **`AppLayout.jsx` route gate** — remove the new `if (user && items.length
   > 0 && !items.some(...))` block (search for the "SECURITY: this route
   group has no per-page role check" comment). Pure UI, no data access
   involved; reverting only re-opens the UI-reachability gap, not a data
   exposure.
3. **CI workflow** — delete `.github/workflows/ci.yml`. No effect on the
   app itself, only on what runs in GitHub Actions.
4. **CHANGELOG / version bump** — revert `CHANGELOG.md` (delete) and
   `package.json`'s `version` field back to `0.0.0`. Cosmetic only.
5. **Dependency removal (`@stripe/*`, `react-quill`) + `npm audit fix`** —
   `git checkout <prior-commit> -- package.json package-lock.json && npm install`.
   Since nothing in `src/`/`base44/` imports any of the three removed
   packages, restoring them only re-adds dead weight (and the `quill` XSS
   advisory) — it cannot break a working feature, because no feature used
   them.
6. **`docs/permissions-matrix.md` reconciliation** — revert to the
   2026-07-28 version if the new pass-4 section is somehow wrong; the
   underlying `.jsonc` files are the source of truth regardless of what the
   doc says.

### Data / permission rollback notes

- No data migrations in this pass — every change is either RLS
  (`EmployeeDocument.jsonc`), client-side routing (`AppLayout.jsx`), or
  tooling/docs. No `AttendanceRecord`, `EmployeeDocument`, or any other
  business-data row is touched, moved, or reformatted.
- The `EmployeeDocument.read` narrowing is the only rollback with a
  *behavioral* consequence if reverted: it re-opens cross-employee document
  reads within a company. If this ships and later needs reverting for an
  unrelated reason, do it as its own revert (item 1 above), not bundled
  with anything else, precisely because it's the one PII-relevant change.

### Manual owner action needed

- **Deploy the schema change.** Per the Deploy note in
  `docs/2026-07-28-audit-rollback.md` (same pattern applies here): committing
  `base44/entities/EmployeeDocument.jsonc` to this repo does **not** change
  anything at runtime. Someone with Base44 CLI/dashboard access needs to run
  the publish step for the new `EmployeeDocument.read` rule to actually take
  effect against the live backend. Until that happens, the live app is
  still running the wider (company-wide) read rule described as "before"
  in finding 1, regardless of what's merged here.
- **Confirm the deployed schema matches the repo** for *all* entities, not
  just this pass's change — this session had no way to do that (see
  "Base44 live schema verification: Blocked" above). A prior pass's fix
  could in principle have been reverted or drifted on the live backend
  without the repo showing it.
- **Decide on the react-router-dom v6→v7 migration** (finding 6) — separate,
  dedicated PR recommended; not done here.
- **Decide on the typecheck backlog** (236 pre-existing errors) — separate,
  dedicated PR recommended; not done here, informational-only in CI for now.

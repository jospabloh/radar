# Changelog

All notable changes to RADAR are documented here. This file starts with the
2026-08-03 release-readiness pass (first version bump + changelog); earlier
work is summarized retroactively from git history for context.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), and
versioning follows [Semantic Versioning](https://semver.org/). Entries are
tenant-neutral — no company names, contact details, or internal debug
detail.

## [0.1.4] — 2026-08-24

Scheduled RADAR audit routine re-run. Modules 2/3/11/12/14/15 had already
shipped and merged to `main` between 2026-08-21 and 2026-08-23 without a
version bump or changelog entry — this release catches the changelog up to
what's actually deployed, plus one new fix found in this pass.

### Security

- **`PermissionProfile` RLS had no role check.** `create`/`update`/`delete`
  were scoped to the caller's own company but not to their `app_role` — any
  `employee` or `store_manager` could rewrite their own company's permission
  overrides and grant themselves any key the five Safe functions
  (`_shared/_permissions.ts`) then trust. Flagged as latent in the
  2026-08-22 multi-tenant isolation audit (module 14); fixed here the same
  way `Employee.jsonc` and `ShiftTemplate.jsonc` already close this shape of
  gap — RLS's `user_condition` can't check the custom `app_role` field, so
  writes are now service-role only. No client write path exists yet (only
  reads), so this closes the gap without breaking anything.
- **Closed the founder-bootstrap reopening (module 14, 2026-08-23).** The
  2026-08-21 cross-app deploy accident (see module 11) wiped `Company` back
  to empty, which silently re-armed `completeOnboarding`'s one-time "first
  company ever" bootstrap path — the next unknown signup would have been
  handed `super_admin`. Now requires `PLATFORM_OWNER_EMAIL` in addition to
  the empty table, and fails closed if that env var isn't set.
- **Bridge signatures are now per-app (module 15, 2026-08-23).** The
  Mission Control bridge previously signed/verified with one secret shared
  across the whole ACACIA portfolio, so any app could forge a ticket
  claiming to be another. `acaciaControl`/`notifyTicketCreated` now
  derive/verify a per-app key (`HMAC(master, "acacia.app.v1." + slug)`),
  accepting the legacy master during the portfolio-wide migration window.
- **Roles and permissions were never centrally declared (modules 2/3,
  2026-08-21).** Four roles existed as scattered string literals with three
  independently-drifted label maps; there was no way to grant a
  `store_manager` PTO-approval without also granting company data export.
  New `src/lib/rbac.js` (single role source) and
  `src/lib/permissionRegistry.js` + `PermissionProfile` overrides (13 keys,
  re-checked server-side in all five write/export functions) replace both.

### Changed

- **Deploy tooling now guards against the app-id mixup that wiped this
  repo's data (module 11).** `npm run deploy`/`deploy:site`/`deploy:entities`
  wrap the Base44 CLI and refuse a mismatched `--app-id`; `deploy:entities`
  prints the target app's name and entity count before its confirmation
  prompt. `npm run functions:audit` lists which functions still have
  in-repo callers before any consolidation.
- **Theme switcher gained a "Sistema" (follow OS) option (module 12).** The
  old two-state light/dark toggle in the sidebar footer and mobile header
  was replaced by the shared portfolio corner control (light/dark/system).
- **`npm run test:smoke` added**, run in CI on demand and on a daily cron
  against the deployed site — verifies the served `<title>`, first-paint
  theme, and that the corner theme switcher stays uncovered at three
  breakpoints. Doesn't run in this sandbox (the domains aren't reachable
  through the dev proxy) or in the normal PR pipeline.

### Fixed

- Stale doc comment in `scripts/validate-entity-rls.mjs` claimed CI ran a
  mirrored Deno test (`base44/tests/entity_rls_test.ts`) that doesn't exist
  in this repo — corrected to say what actually enforces these rules today
  (this script, wired into `npm run lint`).

### Not verified

- The `PermissionProfile` RLS fix and the founder-bootstrap/bridge-key fixes
  above are reviewed by hand against the deployed schema/functions info
  recorded in `CLAUDE.md`'s module 14/15 write-ups; this pass didn't
  re-run a live cross-tenant check (there's still only 0 `Company` rows in
  the live schema as of the last audit, so there's no second tenant to test
  against). `npm run deploy:entities` has not been re-run for the RLS
  change in this pass — the `.jsonc` change alone doesn't reach the
  deployed backend.

## [0.1.3] — 2026-08-18

Portfolio-standard audit pass (`jospabloh/acacia-app-standard`), modules 1/3/6/7.

### Security

- **Billing write-gate on Safe functions (module 3).** `updateAttendanceRecord`,
  `resolveApprovalRequest`, `createManagedRecord`, and `createEmployee`
  re-checked `app_role` and tenant scoping but never `Company.status` — a
  suspended or view_only tenant's manager could still approve requests, edit
  attendance, create shift templates, and invite employees. All four now
  check `Company.status` first (`_billingGuard.ts`, `super_admin` bypasses).
  `updateSupportTicket` deliberately left ungated so a suspended company can
  still reach support. Not independently verified against the live deployed
  backend — `deno` isn't available in this environment and this repo's CI
  has no Deno test step for `base44/functions/*.ts`.

### Added

- **Account export + danger zone (module 7).** `CompanySettings.jsx` only
  ever exposed name/timezone/whatsapp_enabled before this — new
  "Descargar mis datos" (`exportCompanyData`, every read scoped to the
  caller's own `company_id`) and "Solicitar eliminación de la empresa" (a
  high-priority `SupportTicket` routed to Mission Control, not a direct
  delete — RLS reserves `Company.delete` to the platform owner by design).

### Investigated, not a gap

- **No "trial" status on `Company.status` (module 1).** Confirmed RADAR has
  no self-serve signup that would start a trial clock — `Register.jsx`
  creates a user account only, and every `Company` after the first-ever one
  is created exclusively through `SuperAdminCompanies.jsx`, a `super_admin`-
  only manual form. A trial phase with no entry point to reach it would be
  speculative UI, not a real feature. See `CLAUDE.md` for the full writeup.

## [0.1.2] — 2026-08-10

Scheduled RADAR audit routine re-run. Re-verified the full security/quality
checklist from the 2026-08-03/08-05 passes (tenant isolation, WhatsApp
check-in/out scoping, role checks, permissions matrix, changelog, CI) — no
regressions found; see `docs/2026-08-10-audit-rollback.md` for the full
findings-by-severity writeup. One new item surfaced since 0.1.1:

### Security

- **[Low] Three new transitive dev/build-time dependency advisories**,
  none previously flagged: `nanoid` <3.3.17 (high — zero-size custom
  generator can loop indefinitely; pulled in by `postcss`, build-time only),
  `js-yaml` 4.0.0–4.3.0 (high — quadratic CPU consumption parsing `!!omap`;
  pulled in by `eslint`, dev-only, this app never parses untrusted YAML),
  and `dompurify` <=3.4.12 (moderate — `IN_PLACE` hook removal can leave a
  detached subtree executable; pulled in by `jspdf`, used for
  client-generated PDFs, not fed attacker-controlled DOM directly). All
  three are transitive (no direct dependency on any of them) and none are
  reachable via untrusted end-user input in this app. Fixed with
  `npm audit fix` — patch-level only (`nanoid` 3.3.16→3.3.18, `js-yaml`
  4.3.0→4.3.1, `dompurify` 3.4.12→3.4.13), verified via dry run to add no
  new majors and change no other dependency; `npm audit` now reports 0
  vulnerabilities. Re-verified after the bump: lint clean, build clean,
  `validate:rls` still passes (14 entities, 12 tenant-scoped), `typecheck`
  stays at exactly 236 pre-existing errors (same count as 0.1.1, none new).

### Re-verified (no regression found)

- Tenant isolation on all 14 `base44/entities/*.jsonc` files — deployed
  Base44 schema (via `list_entity_schemas`) matches the repo `.jsonc`
  exactly; every tenant-scoped entity carries the `rls` block added in
  PRs #5–#10.
- WhatsApp attendance flow: `AttendanceRecord` create/update RLS still
  requires both `data.company_id == {{user.data.company_id}}` and
  `data.employee_id == {{user.data.employee_id}}`, so a check-in/out write
  cannot target another employee's or company's record. The `/15min`
  cron (`attendanceMonitor`) only reads via the service role and only
  writes `absent`/`auto_logout` records it derives itself, not from
  caller input. `updateAttendanceRecord` (the manager cross-employee write
  path) still gates on `MANAGER_ROLES` + same-company before using the
  service role.
- No secrets committed; `.env`/`.env.*` stay gitignored.
- `docs/permissions-matrix.md` role set (`employee`, `store_manager`,
  `company_admin`, `super_admin`) and module list still match
  `Employee.role` / `User.app_role` in the deployed schema — no drift.
- `UserManual.jsx` (tenant-neutral, no internal debug detail) already
  exists — no gap to fill this pass.
- No Stripe usage (`@stripe/*` was removed in 0.1.0 and stays removed).

## [0.1.1] — 2026-08-05

Follow-up to the 0.1.0 release-readiness pass: the deferred
`react-router-dom` v6→v7 migration (see the Security section of 0.1.0 and
`docs/2026-08-03-audit-rollback.md`, finding 6). Dependency/audit-hygiene
change only — no route, redirect, or behavioral changes.

### Changed

- `react-router-dom` `^6.26.0` → `^7.18.2`. No import changes needed (v7
  keeps `react-router-dom` as a compatibility re-export of `react-router`)
  and no code changes needed — this app uses only the declarative
  `BrowserRouter`/`Routes`/`Route` API (`Navigate`, `Outlet`, `Link`,
  `useLocation`, `useSearchParams`, `useNavigationType`), no data-router
  APIs (`createBrowserRouter`, loaders/actions, `Form`, `json()`/`defer()`),
  so none of the v6→v7 breaking changes apply. All routes, redirects, and
  the catch-all 404 route re-verified after the bump.

### Security

- Clears the residual moderate `react-router-dom` advisories tracked since
  0.1.0 (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) — both required the
  major-version bump.
- Bumping to the current v7 latest surfaces one new high-severity advisory,
  GHSA-qwww-vcr4-c8h2 ("RSC Mode CSRF Bypass"), affecting `react-router`
  7.12.0–8.2.0. **Investigated, not applicable**: the advisory only affects
  apps using React Router's unstable RSC (React Server Components) APIs;
  this app uses plain client-side declarative routing (no framework mode,
  no server actions/loaders, no RSC), confirmed by re-checking the full
  `react-router-dom` import surface. `npm run typecheck` stayed at exactly
  236 pre-existing errors (none router-related), so no scope crept in from
  the bump. `npm audit --audit-level=high` remains non-zero for this
  reason and stays informational/non-blocking in CI (see workflow comment)
  until the ecosystem publishes a patched `react-router-dom` build, or a
  future pass moves the app fully onto the `react-router` package (v8+,
  which dropped the separate `-dom` package) to clear it outright — tracked
  as a follow-up, out of scope here since it would mean rewriting all 12
  `react-router-dom` import sites.

## [0.1.0] — 2026-08-03

First versioned release. This pass focused on release-readiness (this
changelog, semantic versioning, CI, a permissions-matrix reconciliation) on
top of an app that already had five merged security-audit rounds; see
`docs/2026-08-03-audit-rollback.md` for the full audit report.

### Added

- `CHANGELOG.md` (this file) and semantic versioning, starting at `0.1.0`.
- GitHub Actions CI (`.github/workflows/ci.yml`) — the repo had none before
  this pass. Runs lint, build, and RLS-schema validation as required checks;
  runs typecheck and `npm audit` informationally (see workflow comments for
  why they're not yet blocking).
- Route-level role enforcement in `AppLayout` — every admin/manager page
  (Employees, CompanySettings, LicenseManagement, SuperAdminCompanies,
  ShiftSettings, etc.) now redirects a signed-in user whose role's nav menu
  doesn't include that page, instead of rendering it. The underlying data
  access was already correctly scoped by entity RLS / service-role
  functions, so this closes a UI-reachability gap rather than a data
  exposure — see the Security section below and the rollback doc for detail.

### Changed

- `docs/permissions-matrix.md` reconciled against the current
  `base44/entities/*.jsonc` RLS rules — re-verified role set (`employee`,
  `store_manager`, `company_admin`, `super_admin`), re-verified every "own /
  company / fn / service only" scope against the actual `rls` block backing
  it, and added the `EmployeeDocument.read` narrowing below.

### Security

- **[Medium] `EmployeeDocument.read` narrowed from company-wide to the
  document owner's own record** (plus the service role). Previously any
  signed-in member of a company could read any coworker's uploaded
  documents (identification, contracts) by passing a different
  `employee_id` directly to the SDK — the only client reader
  (`EmployeeProfile.jsx`) always scoped to the caller's own record, so nothing
  legitimate depended on the wider rule. No manager-facing document review
  UI exists today; if one is built, it should reopen this with a
  role-checked path (mirroring the existing manager-only service functions),
  not a blanket company-wide read.
- **[Low] Missing route-level role gate on admin/manager pages** — see
  "Added" above. Any authenticated user could previously reach an
  admin-only page (e.g. `/gestion-licencias`, `/companies`) by URL even
  though the sidebar never linked to it for their role. Entity RLS and the
  manager-only service functions (`createEmployee`, `resolveApprovalRequest`,
  `createManagedRecord`, `updateSupportTicket`, `updateAttendanceRecord`)
  already blocked the underlying writes/cross-tenant reads in every case
  checked, so this was a UI-reachability gap, not a data exposure — fixed as
  defense in depth.
- Removed three unused dependencies: `@stripe/react-stripe-js`,
  `@stripe/stripe-js` (no import anywhere in the app — the license/upgrade
  flow is a `SupportTicket` request reviewed by a human, not a Stripe
  checkout; matches this portfolio's "Stripe is not used" policy) and
  `react-quill` (also unused; its transitive `quill` dependency carried a
  known moderate XSS advisory, resolved by removal rather than upgrade).
- Applied `npm audit fix` for a high-severity `brace-expansion` ReDoS
  advisory and a moderate `react-router`/`react-router-dom` advisory (the
  patch-level fix; a residual moderate `react-router-dom` advisory needs a
  major-version bump to fully clear — tracked, not fixed, in the rollback
  doc, since a v6→v7 router migration is out of scope for this pass).
- Re-verified (no regression found): tenant isolation on every
  `base44/entities/*.jsonc` file, the manager-role checks in every
  service-role function under `base44/functions/`, and the
  `AttendanceRecord` create/update scoping that prevents one employee from
  writing another's check-in/out record.

## Earlier history (reconstructed from git log, unversioned)

- **2026-07-28 — Security audit, 3 passes (PRs #8, #9, #10).** Closed
  self-approval and billing-escalation RLS gaps (Company billing fields,
  PTO/schedule/extension request approval, `User`/`NotificationPreference`
  write scoping); closed the remaining RLS-only gaps across `Employee`,
  `PTORequest`/`ExtensionRequest`, `ScheduleChangeRequest`, `ShiftTemplate`,
  `Holiday`, `EmployeeDocument`, `SupportTicket`/`SupportTicketMessage`;
  added the `createEmployee`/`updateSupportTicket` service functions,
  fixed sidebar navigation for 10 pages, deduplicated `auth.me()` calls,
  added error handling to CRUD mutations, consolidated attendance-status
  styling, fixed dark-mode-unsafe hardcoded colors.
- **2026-07-23 (PR #7).** Scoped `AttendanceRecord` create/update to the
  caller's own employee, closing a cross-tenant/cross-employee write gap.
- **2026-07-08 (PR #6).** Closed a full cross-tenant privilege-escalation
  hole in `User` RLS.
- **2026-07-06 (PR #5).** Fixed a critical cross-tenant RLS gap — 10
  entities had no `rls` block at all (unenforced, any authenticated user,
  any tenant). Added the `validate:rls` guard script.
- **2026-07-05 (PR #3).** Added `AppSession` + heartbeat with force-logout,
  and the ACACIA Mission Control `sessions.list`/`sessions.revoke` bridge.
- **2026-07-01 (PRs #1, #2).** Initial RADAR UI (design system, dark mode)
  and ACACIA Mission Control integration (tickets + licenses bridge).
- **2026-06-25.** Initial commit.

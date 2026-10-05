# Changelog

All notable changes to RADAR are documented here. This file starts with the
2026-08-03 release-readiness pass (first version bump + changelog); earlier
work is summarized retroactively from git history for context.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), and
versioning follows [Semantic Versioning](https://semver.org/). Entries are
tenant-neutral — no company names, contact details, or internal debug
detail.

## [0.1.12] — 2026-10-05

- Security: `npm audit fix` cleared the high-severity advisories on `axios`
  and `brace-expansion` (lockfile only, within existing semver ranges).
  One high advisory remains on `braces` (transitive build-time dependency
  of `tailwindcss`/`micromatch`, no patched release exists upstream —
  3.0.3 is the latest); it is not shipped in the browser bundle.

## [0.1.11] — 2026-10-02

- Fixed: `SuperAdminCompanies.jsx`'s "Nueva empresa" silently failed with a
  403 for any `super_admin` account that is not also a Base44 platform
  collaborator/admin on this app — `Company.jsonc`'s `create` RLS checks the
  platform `role` field, which RADAR's own `app_role` custom field (what the
  page is actually gated by) is structurally invisible to. New `createCompany`
  service-role function re-checks `app_role === 'super_admin'` in code, the
  same shape `createEmployee` already uses for `Employee.create`. Found and
  confirmed live during a QA pass driving a second `super_admin` test account
  through the real UI.

## [0.1.10] — 2026-09-30

- Email verification by code (OTP) for password accounts: new shared
  `VerifyEmailStep` used by Register and, new, by Login when the platform
  rejects an unverified account (previously the raw English error).
- Onboarding: a signed-in user whose email has no Employee row now sees an
  explicit "not associated to a company" screen with support contacts; a real
  failure (network/5xx) is no longer shown as that.
- `completeOnboarding` ignores inactive Employee rows and unknown roles and
  matches the email case-insensitively; `createEmployee` refuses an email that
  already belongs to a company (409) and verifies the company exists for a
  super_admin invite.
- `npm test` (node --test) and a Deno step in CI.

## [0.1.9] — 2026-09-28

Scheduled RADAR audit routine re-run (16-point pass). No open PRs; the
`audit/radar-full-review` branch was a stale leftover from the already-merged
2026-09-21 pass (PR #38) — this pass's work went to the harness-assigned
`claude/brave-mendel-cvt1v1` branch instead, itself restarted from `main` per
the merged-PR protocol (its own prior PR had also already merged, and the
remote branch had been deleted). Ran Base44's fresh security scan (not a
cached read); it re-confirmed the 2026-09-21 cross-tenant fix is deployed and
holding, cleared the two items it had previously flagged as informational
non-issues (`PLATFORM_OWNER_EMAIL` registration, `notifyTicketCreated`'s
`role`-vs-`app_role` check), and surfaced one new confirmed finding.

### Fixed

- **`exportCompanyData` returned every employee's private HR document link to
  any exporting manager (high severity, confirmed by Base44's security
  scanner).** `EmployeeDocument`'s own read RLS deliberately restricts a
  document to its own employee (or a platform admin) — even
  `company_admin`/`store_manager` have no read access to a coworker's
  uploaded ID or contract, by design (see the entity's `.jsonc` comment from
  the 2026-08-03 fix). `exportCompanyData` runs `asServiceRole` and returned
  every `EmployeeDocument` row's `file_uri` verbatim, gated only by the
  `Empresa:export_data` permission both those roles hold by default — so any
  manager who exported their company's data could turn a coworker's
  `file_uri` into an openable document via `Core.CreateFileSignedUrl`
  (the same call `EmployeeProfile.jsx` already makes), defeating the
  per-employee restriction entirely. Fixed by stripping `file_uri` from
  `EmployeeDocument` records before they're included in the export — the
  record (who it belongs to, the file's name) still reflects what's on file,
  but the export no longer hands out a usable pointer to the file itself.
  Deployed directly to the live backend the same pass (checkpoint
  `6aba17ec6b2ac0e7f894ccec`), not left at "merged to `main`" — module 11's
  own lesson that merging doesn't deploy.

### Verified, no changes needed

- `resolveApprovalRequest`'s 2026-09-21 cross-tenant fix: re-read directly
  from the live Base44 sandbox, byte-identical to the repo, and the fresh
  scan's own `static_code_findings` came back clean for it this time
  (2026-09-21's scan had predated the fix by minutes and was reading stale
  cache on 2026-09-21's own first poll).
- `PermissionProfile`'s service-role-only RLS, `EmployeeDocument.file_uri`
  private-storage rename, the module-15 bridge's derived-key/
  `ACCEPT_LEGACY_MASTER=false`, and `completeOnboarding`'s
  `PLATFORM_OWNER_EMAIL` founder-door gate: all re-confirmed deployed via
  direct schema/file reads against the live app.
- `PLATFORM_OWNER_EMAIL` secret: confirmed actually **set** (present in the
  app's secret list, not just referenced in code) — the fresh scan's flag on
  it was Base44's own "unregistered env var" bookkeeping, not evidence the
  value was missing.
- `notifyTicketCreated`'s `role`-vs-`app_role` check: re-investigated:  every
  real call site notifies a ticket the caller just created themselves, so the
  scanner's hypothetical "blocks a coworker's ticket" case doesn't occur in
  practice — confirmed non-issue, unchanged from the 2026-09-21 write-up.
- `attendanceMonitor` workflow: active, 0 consecutive failures, last run
  minutes before this pass started (9 minutes), 3881 total runs — healthy
  since its 2026-09-14 reactivation.
- `npm run lint` (eslint + `validate:rls` 15/13 + `validate:permissions`
  13/5 + `validate:functions` 10 endpoints), `npm run build`, and
  `npm audit --audit-level=high` (0 vulnerabilities) all pass.
- `npm run typecheck` — 252 errors, unchanged since 2026-08-24 (no new
  drift, including from this pass's own `exportCompanyData/entry.ts` edit —
  `deno check` on the edited file found only the same pre-existing
  implicit-`any` noise in `_permissions.ts` every prior pass has recorded,
  nothing new).
- Secrets scan (`git grep` for key/token/secret/password literals): clean;
  no `.env*` committed.
- `_billingGuard.ts` (4 copies) and `_permissions.ts` (6 copies): still
  byte-identical to each other (checked via `md5sum`).

### Not verified

- App public/private visibility — open since 2026-08-22, still not
  confirmable from this environment: the Base44 platform API's `GET
  /api/apps/{id}` documents no visibility field, and no other catalog area
  (access-requests, metadata, group-shares) exposes one either. Worth a
  direct check in the Base44 dashboard.
- Live tenant data unchanged: 0 `Company` rows, 1 `User` (the platform
  owner) — no second tenant exists to exercise role-boundary or the fixed
  export behavior against with real data. UI/UX/cross-device/performance
  review, live UAT, and email deliverability were not exercised — no browser
  session against a live deploy exists here, same limitation every prior
  pass has recorded.

## [0.1.8] — 2026-09-21

Scheduled RADAR audit routine re-run (16-point pass). No open PRs, no stale
audit branches; branch `audit/radar-full-review` restarted from `main` per
the merged-PR protocol (its previous pass, PR #37, had already merged). This
pass ran Base44's fresh security scan (not a cached read) and it surfaced a
confirmed, high-severity cross-tenant write.

### Fixed

- **Cross-tenant write in approval side-effects (high severity, confirmed by
  Base44's security scanner).** `resolveApprovalRequest`'s only tenant check
  was on the approval request's own `company_id` — never on the `employee_id`
  (for a `ScheduleChangeRequest`) or `attendance_record_id` (for an
  `ExtensionRequest`) it then writes to via `asServiceRole`. A manager could
  propose a schedule change for an `employee_id` belonging to a different
  company (`createManagedRecord` forces `company_id` to the caller's own
  tenant but never validated `employee_id` against it), or an employee could
  file an `ExtensionRequest` whose `attendance_record_id` pointed at a
  different company's attendance record (its own RLS never checks that
  field). Either one, once approved by a same-company manager, would write
  into another tenant's `Employee.schedule` or `AttendanceRecord` — a real
  multi-tenant isolation break. Fixed by verifying the referenced record's
  own stored `company_id` against the approval request's `company_id`,
  in `resolveApprovalRequest` (the actual write, and the fix that closes both
  attack paths regardless of how the bad reference got created) and,
  defense-in-depth, in `createManagedRecord` (rejects the bad `employee_id`
  at creation time instead of only at approval). Deployed directly to the
  live backend the same pass (not just merged to `main` — module 11's own
  lesson), verified present in the running container afterward.
- **`PLATFORM_OWNER_EMAIL` was never actually set.** Flagged as a suspicion
  since 2026-09-14 (the security scanner read it as an "unregistered
  environment variable" but couldn't be confirmed from this sandbox back
  then). This pass confirmed it directly — the secrets API reported it as
  newly `created`, not `updated` — and set it to the platform owner's own
  email, closing the module-14 founder-recovery path that had been
  unusable by anyone, including the real owner, since it was added.

### Investigated, not a bug

- **`notifyTicketCreated`'s staff bypass uses the platform `role` field, not
  the app's `app_role`.** The scanner read this as blocking `company_admin`/
  `store_manager` from notifying a ticket a different employee created.
  All three call sites (`CompanySettings.jsx`, `SupportCenter.jsx`,
  `LicenseManagement.jsx`) invoke it immediately after the same request
  creates its own ticket, so the caller always owns the ticket they're
  notifying about — the "different employee's ticket" case this would
  block never occurs in this codebase. `role` vs `app_role` here is the
  intentional Base44-platform-staff vs. RADAR-tenant-role split documented
  elsewhere in this file, not a mix-up. No fix needed; even a false silent
  failure here only delays Mission Control's awareness by up to a day,
  since the ticket itself is already durably written and picked up by the
  daily pull sync regardless (module 8).
- **A stale scan finding claimed `attendanceMonitor` 401s on scheduled
  invocation.** The function does require `base44.auth.me()` to return an
  admin; live run history (33+ consecutive scheduled runs this pass
  checked, 0 failures, matching the 2537-total/6-failed record from
  2026-09-14) shows Base44's own scheduler satisfies that check when
  invoking the workflow. Not reproducible against the live app.

### Verified this pass (new)

- Login and register pages rendered and screenshotted locally via Playwright
  at mobile/tablet/desktop viewports: no console page errors, theme switcher
  present and working (including a live light→dark toggle carried across
  navigation), no layout breakage — the first real browser check any pass
  has been able to run, previously blocked by "no browser session against a
  live deploy" (this checks the local build, not the deployed site, but is
  new signal on UI/UX/module-12 no prior pass had).
- `EmployeeDocument.file_uri` (2026-09-14's private-storage rename) and
  `PermissionProfile`'s service-role-only RLS (2026-08-24's fix) both
  re-confirmed deployed via `list_entity_schemas` against the live schema.
- Attendance-monitor workflow re-confirmed active and healthy (0 consecutive
  failures) after the 2026-09-14 reactivation.

**Checks run:** `npm run lint` (eslint + `validate:rls` 15/13 +
`validate:permissions` 13/5 + `validate:functions` 10 endpoints), `npm run
build`, `npm audit --audit-level=high` (0 vulnerabilities), `npm run
typecheck` (252 errors, unchanged), `npm run functions:audit` (10 endpoints,
`attendanceMonitor` still the sole `REVISAR EN PANEL` entry), `deno check`
on both edited `entry.ts` files (no new errors beyond the same pre-existing
implicit-`any` SDK-typing noise every prior pass has recorded), secrets scan
clean.

**Not verified.** App public/private visibility — open since 2026-08-22,
still not re-confirmable from this environment. Live tenant data unchanged:
0 `Company` rows, 1 `User` (the platform owner) — no second tenant exists to
exercise the fixed cross-tenant check against with real data (the fix was
verified by code inspection and live deploy confirmation, not by an actual
cross-tenant approval attempt). Cross-device/performance review, live UAT,
and email deliverability were not exercised.

## [0.1.7] — 2026-09-14

Scheduled RADAR audit routine re-run (16-point pass). No open PRs, no stale
audit branches. This pass had authenticated Base44 MCP access to the live
app, which turned up a real live-operations bug the repo-only checks in
every prior pass couldn't see.

### Fixed

- **The attendance-monitor scheduled workflow had been silently disabled
  since 2026-07-29.** `Monitor de Asistencia` (runs `attendanceMonitor`
  every 15 minutes — marks no-shows absent, auto-closes open shifts) hit 5
  consecutive failures ("No deployment URL for function 'attendanceMonitor'")
  and Base44 auto-disabled it. The underlying deploy problem was already
  gone by the time of this pass — a manual run-now completed successfully —
  but the workflow itself stays off until someone flips it back on, and
  nobody had. Confirmed live before touching it (`workflows` API: 2537 total
  runs, 6 failed in a row starting exactly at the point it went dark, 0
  since), ran it manually to prove the fix would hold, then re-activated it.
  Six-plus weeks of missed absence-marking and auto-checkout — no prior
  audit pass had live Base44 access to catch this; the functions-in-use
  audit correctly listed `attendanceMonitor` as having no in-repo caller
  (expected — it's schedule-triggered) but had no way to see the schedule
  itself was off.
- **Employee HR documents (IDs, contracts) were uploaded to public
  storage.** Base44's own security scanner (run this pass) flagged
  `EmployeeProfile.jsx`: `Core.UploadFile` writes to permanent,
  world-readable storage, so the file's metadata row was RLS-scoped to the
  owning employee while the file itself was reachable by anyone with the
  URL — no auth required. Switched to `Core.UploadPrivateFile` +
  `Core.CreateFileSignedUrl` (a short-lived link resolved on open, not
  stored). `EmployeeDocument.file_url` renamed to `file_uri` to match — safe
  as a hard rename, not a migration, because the live schema had 0
  `EmployeeDocument` rows. Needs `npm run deploy:entities` to reach the
  deployed schema (see Not verified below); `exportCompanyData`'s generic
  pass-through needed no change and, as a side effect, now exports an opaque
  private-storage URI instead of a directly-fetchable public link.
- **1 dependency vulnerability** (`npm audit --audit-level=high`: 1 high —
  `js-yaml`, GHSA-2883-xcg3-v3hh, unbounded CPU on an empty merge source) —
  a transitive build-tooling dependency, not runtime app code. Resolved via
  `npm audit fix` within existing semver ranges.

### Verified (turned prior "not verified" items into confirmed ones)

Live, authenticated Base44 MCP access was available this pass for the first
time since 2026-08-24 (2026-08-31 and 2026-09-07 both hit CLI/auth
timeouts). Used it to close out several items multiple prior passes had
carried as unverified:

- `_billingGuard.ts` (4 copies) and `_permissions.ts` (6 copies, including
  the canonical `_shared` one) are byte-identical between the repo and the
  deployed function source (checked via md5sum on both sides), not just
  "should be" per the generator/validator.
- `completeOnboarding`'s founder-door fix (`PLATFORM_OWNER_EMAIL` check,
  module 14) is deployed and byte-identical to the repo.
- The module-15 bridge's `ACCEPT_LEGACY_MASTER = false` is confirmed in
  both deployed copies (`acaciaControl`, `notifyTicketCreated`).
- `PermissionProfile`'s RLS (service-role-only `create`/`update`/`delete`,
  2026-08-24 fix) is confirmed deployed via `list_entity_schemas` against
  the live schema.
- Ran Base44's own security scan (fresh, not the 2026-08-24 cached result):
  no RLS recommendations, no hardcoded secrets in the sense of literal
  credentials, no other backend-function or dependency findings beyond the
  two fixed above.

### Not verified

- **`PLATFORM_OWNER_EMAIL` may not actually be set.** The fresh security
  scan flagged it as an "unregistered environment variable" read in
  `completeOnboarding/entry.ts` — notably, it did *not* flag
  `INGEST_HMAC_SECRET`/`ACACIA_MC_INGEST_URL`/`ACACIA_APP_SLUG`, which are
  read the same way in neighboring functions, suggesting the scanner can
  tell a registered app secret from one that was never set. This sandbox
  has no way to list or set secrets (`base44 secrets list` needs an
  interactive device-code login this environment can't complete — confirmed
  by trying, not assumed). The code fails closed either way (no email set
  means the founder-recovery path is unusable by anyone, including the real
  owner) — not a vulnerability, but worth the owner confirming directly in
  the Base44 dashboard's Secrets panel, since the module-14 fix's whole
  point was to give the real owner a recovery path.
- **App public/private visibility** — open since the 2026-08-22 module-14
  write-up, attempted again this pass via the platform API (no visibility
  field in `GET /api/apps/{id}`) and via the CLI (`base44 secrets list`
  hung on an interactive login prompt) — still not confirmable from this
  environment. Worth a direct dashboard check.
- The `EmployeeDocument` schema rename is a repo-only change until
  `npm run deploy:entities` runs by hand (module 11) — safe either way per
  the fail-closed-to-defaults precedent this repo already follows for
  schema changes, since there's no live data the old field name touches.
- Live tenant data unchanged: 0 `Company` rows, 1 `User` (the platform
  owner) — still no second tenant to exercise role-boundary enforcement
  against. UI/UX/cross-device/performance review, live UAT, and email
  deliverability were not exercised — no browser session against a live
  deploy exists here, same limitation every prior pass has recorded.

## [0.1.6] — 2026-09-07

Scheduled RADAR audit routine re-run. The prior pass's PR (#35, opened
2026-08-31) had sat open a week with a failed CI check and no follow-up —
closed out this pass rather than left for the next one.

### Fixed

- **4 dependency vulnerabilities** (`npm audit --audit-level=high`: 1 high,
  2 moderate, 1 low) that appeared since the 2026-08-31 pass —
  `browserslist`, `fflate`, `postcss-selector-parser`, `@humanfs/node`, all
  transitive build-tooling dependencies. Resolved via `npm audit fix`
  within existing semver ranges; only `package-lock.json` changed, no
  application code touched.

### Process

- PR #35's CI failure from 2026-08-31 could not be root-caused directly
  (its Actions logs had already expired), but lint/build reproduced clean
  locally on the unmodified branch — consistent with a stale/flaky run.
  Merged latest `main` into it and re-verified before merging.

## [0.1.5] — 2026-08-31

Scheduled RADAR audit routine re-run (16-point pass). No open PRs or stale
audit branches at the start; no functional code had changed since the
2026-08-24 pass (only two automated `Update base44 packages` commits).

### Fixed

- **`EmployeeFormDialog.jsx` role dropdown still hardcoded "Store Manager"
  in English.** Module 2 (2026-08-21) centralized role labels in
  `src/lib/rbac.js` specifically to kill this exact drift, and fixed it in
  `Employees.jsx`'s employee list — but missed this component, the actual
  "create employee" modal `Employees.jsx` renders. Every other role label in
  the app already reads "Gerente de tienda"; this was the one place a
  company admin creating an employee saw the stale English string. Now
  imports `ROLES`/`ROLE_LABELS` from `rbac.js` instead of a local literal.

### Verified (previously open items, now confirmed against the live backend)

- `PermissionProfile`'s RLS fix (service-role-only `create`/`update`/`delete`,
  shipped 2026-08-24) is live in the deployed entity schema — the
  2026-08-24 entry could only confirm this in the repo `.jsonc`.
- `completeOnboarding`'s founder-door fix (`PLATFORM_OWNER_EMAIL` check,
  module 14) is live and matches the repo, read directly from the deployed
  function source.
- The module-15 bridge's derived-key signing was exercised directly (not
  just read): the documented test vector matches, a body signed as one app
  is rejected when verified as another, and a body signed and verified as
  the same app passes — with `ACCEPT_LEGACY_MASTER` confirmed `false`.

### Checked, nothing further to fix

`npm run lint` (eslint + RLS/permissions/functions validators), `npm run
build`, `npm audit --audit-level=high` (0 vulnerabilities), a secrets scan,
a `_billingGuard.ts` drift check across all 4 copies, and a spot RLS review
of `ExtensionRequest`/`PTORequest`/`ScheduleChangeRequest`/`Holiday` all
came back clean.

### Not verified

Live tenant/company data still doesn't exist (0 `Company` rows, 1 `User` —
the platform owner) so role-boundary enforcement still can't be exercised
against real data, same limitation every module-14/15 pass has recorded.
The app's public/private visibility setting (flagged as a real risk in the
2026-08-22 module-14 finding) could not be re-checked this pass — the
Base44 CLI call inside the sandbox timed out twice; this needs a manual
check, not a rerun. UI/UX/cross-device/performance review, live UAT, and
email deliverability were not exercised — no browser session against a
live deploy exists in this environment.

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

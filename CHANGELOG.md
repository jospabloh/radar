# Changelog

All notable changes to RADAR are documented here. This file starts with the
2026-08-03 release-readiness pass (first version bump + changelog); earlier
work is summarized retroactively from git history for context.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), and
versioning follows [Semantic Versioning](https://semver.org/). Entries are
tenant-neutral — no company names, contact details, or internal debug
detail.

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

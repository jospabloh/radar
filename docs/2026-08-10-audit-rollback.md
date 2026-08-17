# RADAR audit + rollback notes — 2026-08-10

Sixth RADAR pass, and the first run of the scheduled RADAR audit routine.
Prior passes: `docs/2026-07-28-audit-rollback.md` (three passes) and
`docs/2026-08-03-audit-rollback.md` (fourth pass, plus the undocumented
0.1.1 react-router-dom v6→v7 bump — see `CHANGELOG.md`). None of those are
superseded — read them too for the full history.

Branch: `claude/relaxed-rubin-u9w725`. Pre-audit tip (this branch, equal to
`main` at the time): `fb2c514`. PII/attendance data is in scope for this
app, so this doc is extra-conservative: the one change below is independent
and reversible on its own.

## Executive summary

This run's starting brief assumed a "known open item" — that no
tenant-scoped entity carried an `rls` block. That was **not reproducible**:
every one of the 14 entities in `base44/entities/*.jsonc` already has an
`rls` block, and the *deployed* Base44 schema (checked directly via
`list_entity_schemas`, not just the repo `.jsonc`) matches the repo exactly,
entity-by-entity. That gap was real once (PR #5, 2026-07-06) and has been
closed and re-verified in every pass since — this run just re-confirmed it
rather than re-fixing something already fixed.

The rest of the routine's checklist — WhatsApp check-in/out spoofing,
role checks on manager-only actions, `EmployeeDocument` access, license/
Stripe flow, CI, changelog, permissions matrix, user manual, dependency
audit — was re-checked against the current code and deployed schema with
no regression found, **except** one new item: three transitive
dev/build-time dependency advisories not present as of the 0.1.1 pass.
Fixed with a patch-level `npm audit fix`; see `CHANGELOG.md` [0.1.2] for
detail. No entity schema, RLS, or application code changed this pass —
only `package-lock.json`, `package.json` (version), `CHANGELOG.md`, and
this doc.

## Findings by severity

Every finding ends in one of: Fixed / Not reproducible / False positive /
Accepted risk / Deferred with issue / Blocked, per the audit routine's
requirement.

### Critical / High

None found this pass. (The routine's brief flagged the missing-`rls`
item as a potential Critical — see Executive Summary: **Not reproducible**,
already fixed in PR #5 and re-verified deployed-vs-repo this pass.)

### Medium

None found this pass.

### Low

1. **Three new transitive dependency advisories** (`nanoid` high,
   `js-yaml` high, `dompurify` moderate) — none present in the 0.1.1
   `npm audit` baseline. All three are transitive dev/build-time-only
   dependencies (via `postcss`, `eslint`, `jspdf` respectively), none
   reachable via untrusted end-user input in this app.
   **Status: Fixed.** `npm audit fix` (patch-level only, verified via
   dry run first — no majors added). `npm audit` now reports 0
   vulnerabilities. Re-verified after: `npm run lint`, `npm run build`,
   `npm run validate:rls` all pass; `npm run typecheck` stays at exactly
   236 pre-existing errors (same as the 0.1.1 baseline — no new errors
   from the dependency bump).

## What else was checked and found clean (no finding, no fix)

- **Tenant isolation** — all 14 entities, deployed schema vs. repo
  `.jsonc`, byte-for-byte equivalent RLS shape.
- **WhatsApp check-in/out spoofing** — there is no custom inbound WhatsApp
  webhook handler in this repo; check-in/out writes go through the
  authenticated Base44 SDK client and are constrained by
  `AttendanceRecord`'s RLS (`data.company_id == {{user.data.company_id}}`
  AND `data.employee_id == {{user.data.employee_id}}` for create/update),
  so a signed-in employee cannot write another employee's or company's
  attendance row. The `/15min` cron (`attendanceMonitor`, service role)
  only derives `absent`/`auto_logout` records from its own read of
  `Employee.schedule` — it takes no caller-supplied `employee_id` or
  `company_id`. The manager cross-employee write path
  (`updateAttendanceRecord`) re-checks `MANAGER_ROLES` and same-company
  before writing, using an explicit field allowlist.
- **Role checks on manager-only actions** — `ShiftTemplate`,
  `PTORequest`/`ExtensionRequest`/`ScheduleChangeRequest` approval,
  `EmployeeDocument` access: RLS matches `docs/permissions-matrix.md`,
  no drift.
- **Secrets** — no hardcoded keys/tokens found in `base44/` or `src/`;
  `.env`/`.env.*` stay gitignored and untracked.
- **License/trial flow** — no Stripe usage anywhere in the app (removed
  0.1.0, confirmed still absent from `package.json` and the import graph);
  upgrades are a `SupportTicket` reviewed by a human, matching this
  portfolio's "Stripe is not used" policy.
- **CI** (`.github/workflows/ci.yml`) — present, lint/build/validate:rls
  blocking, typecheck/audit informational as documented in the workflow's
  own header comment.
- **Permissions matrix / user manual / changelog** — all three already
  exist and are current; role set (`employee`, `store_manager`,
  `company_admin`, `super_admin`) and module list match the deployed
  schema. No gap to fill this pass.

## Checks run

| Check | Result |
|---|---|
| `npm run lint` | Pass, 0 errors |
| `npm run build` | Pass |
| `npm run validate:rls` | Pass — 14 entities, 12 tenant-scoped |
| `npm run typecheck` | 236 pre-existing errors, informational (unchanged from 0.1.1) |
| `npm audit --audit-level=high` | 0 vulnerabilities after fix (was 3: 2 high, 1 moderate) |
| Deployed Base44 schema vs. repo `.jsonc` | Match, no drift (`list_entity_schemas`) |

## Rollback

- **Branch:** `claude/relaxed-rubin-u9w725`
- **Pre-audit commit:** `fb2c514` (tip of `main` at run start)
- **Post-audit commit:** see PR — one commit, `package.json` +
  `package-lock.json` + `CHANGELOG.md` + this doc only.
- **Version:** `0.1.1` → `0.1.2`
- **Revert command:** `git revert <post-audit-commit-sha>` (single commit,
  no dependencies on other changes) — or simply `npm install` against the
  pre-audit `package-lock.json` to roll back the three patch bumps.
- **Data/permission rollback:** none — no entity schema, RLS, or
  Base44-deployed change was made this pass.
- **Manual owner action required:** none beyond the normal PR
  review/merge decision. No env vars, secrets, or Base44 deploy steps
  needed for this change (dependency-lockfile-only).

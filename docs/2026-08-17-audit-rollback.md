# RADAR audit + rollback notes — 2026-08-17

Seventh RADAR pass, second run of the scheduled RADAR audit routine. Prior
passes: `docs/2026-07-28-audit-rollback.md` (three passes),
`docs/2026-08-03-audit-rollback.md` (fourth pass), `docs/2026-08-10-audit-rollback.md`
(sixth pass, PR #14). None of those are superseded — read them too for the
full history.

Branch: `claude/awesome-cannon-kh2lqf`. Pre-audit tip of `main`: `fb2c514`.

## Executive summary

This run's first finding was procedural, not code: **PR #14** (the prior
routine run, 2026-08-10) had been sitting as a draft for a week with every
check green (`mergeable_state: clean`, CI passed, no unresolved findings) —
left in draft under that run's own "merging is left to the owner" rule.
This routine's standing instructions now explicitly authorize auto-merging
a PR once its checks pass, so it was flipped to ready-for-review and merged
(`d1ad482`) as this run's first action, rather than left to accumulate
further. **No other backlog** — no other open/stale/disconnected audit
branches or draft reports existed at inventory time.

With `main` at `d1ad482` (the merged 0.1.2), the rest of this pass
re-verified the full checklist against current code and the **live**
deployed Base44 schema. **No new findings.** No entity schema, RLS
declaration, or application code changed this pass — this doc is the only
new file.

## Findings by severity

Every finding ends in one of: Fixed / Not reproducible / False positive,
per the audit routine's requirement.

### Critical / High / Medium / Low

None found this pass.

## What was re-checked (no regression found)

- **Tenant isolation (RLS) — all 14 entities.** Went one step further than
  prior passes' visual read-through: pulled the live schema via
  `list_entity_schemas` and diffed it **programmatically** (order-independent,
  deep-equal on the full `rls` block, every field-level `rls` override, and
  `required[]`) against every `base44/entities/*.jsonc` file. Result:
  **exact match on all 14 entities, zero drift.** This closes the gap the
  2026-08-10 doc flagged — that pass could only confirm a human read of the
  deployed schema matched; this pass confirms it byte-for-byte via script,
  not eyeballing.
- **Manager-only / service-role gates** — spot-checked the five
  service-role functions (`updateAttendanceRecord`, `resolveApprovalRequest`,
  `createManagedRecord`, `createEmployee`, `updateSupportTicket`) plus
  `acaciaControl` (the Mission Control HMAC bridge): HMAC signature is
  timing-safe (`timingSafeEqual`), request freshness is enforced against a
  skew window with an explicit `Number.isFinite` guard (a non-numeric `ts`
  can't slip through as `NaN`), and outbound email fields are validated
  against header-injection (`isSafeEmail`/`isSafeHeader` reject CR/LF and
  list separators). None of these files have changed since PR #10
  (2026-07-28) — unchanged, so no re-audit finding, just re-confirmed.
- **Secrets** — no hardcoded keys/tokens in `base44/` or `src/`; `.env`/`.env.*`
  stay gitignored and untracked (`git ls-files` returns none).
- **Automated QA** — no test suite exists in this repo (`find` for
  `*.test.*`/`*.spec.*` returns nothing); unchanged from every prior pass.
  Noting again here so this isn't silently dropped from the record: adding
  one is still open work, not something this pass could "fix" — component
  tests would need a decision on framework (none installed) and are a
  larger scope change than a re-verification routine should make
  unilaterally.
- **Docs** — `docs/permissions-matrix.md`, `UserManual.jsx`, `CHANGELOG.md`
  all already exist and are current; role set (`employee`, `store_manager`,
  `company_admin`, `super_admin`) and module list still match the deployed
  schema. No gap to fill.
- **CI** (`.github/workflows/ci.yml`) — present, lint/build/validate:rls
  blocking, typecheck/audit informational, as documented in the workflow's
  own header comment.
- **No Stripe usage anywhere** (confirmed still absent) — upgrades stay a
  human-reviewed `SupportTicket`, matching the portfolio's "Stripe is not
  used" policy.

## Checks run

| Check | Result |
|---|---|
| `npm run lint` | Pass, 0 errors |
| `npm run build` | Pass |
| `npm run validate:rls` | Pass — 14 entities, 12 tenant-scoped |
| `npm run typecheck` | 236 pre-existing errors, informational (unchanged from 0.1.2) |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Deployed Base44 schema vs. repo `.jsonc` | Exact match, programmatic diff, all 14 entities — no drift |

## Rollback

- **This pass's only action:** merging PR #14 and adding this doc.
- **PR #14 merge:** branch `claude/relaxed-rubin-u9w725`, merge commit
  `d1ad482` onto `main` (was `fb2c514`). Revert with `git revert d1ad482`
  if the 0.1.2 dependency bumps (`nanoid`, `js-yaml`, `dompurify`) need to
  come out — see `docs/2026-08-10-audit-rollback.md` for that change's own
  detail.
- **This doc's commit:** adds `docs/2026-08-17-audit-rollback.md` only, no
  app code, no version bump (nothing shipped this pass beyond the merge
  above). Revert with `git revert <this-commit-sha>`.
- **Data/permission rollback:** none — no entity schema, RLS, or
  Base44-deployed change was made this pass.
- **Manual owner action required:** none.

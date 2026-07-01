/**
 * Shared validation for Base44 entity RLS rules. Used by both the Node CLI
 * (scripts/validate-entity-rls.mjs) and the Deno test (base44/tests/
 * entity_rls_test.ts), so local runs and CI enforce the exact same rules.
 *
 * Background — the "cero items" outage (2026-06-16): every entity↔user RLS
 * comparison has two halves, and getting either wrong fails silently:
 *
 *   - ENTITY side: custom fields live under `data.` in Base44. A rule key must
 *     be a built-in (id, created_by_id, created_date, updated_date) or start
 *     with `data.`. A bare `company_id` references a non-existent field → the
 *     rule never matches → RLS effectively OFF (cross-tenant leak).
 *
 *   - USER side: custom user fields resolve as `{{user.data.<field>}}`. The
 *     only bare built-ins are `{{user.id}}`, `{{user.email}}`, `{{user.role}}`.
 *     `{{user.company_id}}` resolves to nothing → the rule matches nothing →
 *     ZERO rows for everyone (the actual prod failure).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BUILTIN_ENTITY_FIELDS = new Set([
  "id",
  "created_by_id",
  "created_by",
  "created_date",
  "updated_date",
]);
const BUILTIN_USER_VARS = new Set(["id", "email", "role"]);
const LOGICAL_OPERATORS = new Set(["$or", "$and", "$nor", "$not"]);

/** Strip // and block comments so JSONC parses as JSON. */
export function parseJsonc(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return JSON.parse(noLine);
}

function checkUserTemplates(value, entity, opLabel, errors) {
  const json = JSON.stringify(value);
  const re = /\{\{\s*user\.([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(json)) !== null) {
    const path = m[1];
    if (path.startsWith("data.")) continue;
    if (BUILTIN_USER_VARS.has(path)) continue;
    errors.push(
      `${entity} [${opLabel}]: user template "{{user.${path}}}" is invalid. ` +
        `Custom user fields must be "{{user.data.${path}}}" ` +
        `(only id/email/role are bare built-ins).`,
    );
  }
}

function checkEntityKeys(rule, entity, opLabel, errors) {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) return;
  for (const key of Object.keys(rule)) {
    if (key === "user_condition") continue;
    if (LOGICAL_OPERATORS.has(key)) {
      const branches = Array.isArray(rule[key]) ? rule[key] : [rule[key]];
      branches.forEach((b) => checkEntityKeys(b, entity, opLabel, errors));
      continue;
    }
    if (key.startsWith("$")) continue;
    if (key.startsWith("data.")) continue;
    if (BUILTIN_ENTITY_FIELDS.has(key)) continue;
    errors.push(
      `${entity} [${opLabel}]: rule key "${key}" must use the "data." prefix ` +
        `(custom entity fields live under data.; bare "${key}" matches nothing ` +
        `→ RLS effectively disabled).`,
    );
  }
}

/**
 * Scan an entities directory and return { errors, total, businessScoped }.
 * errors is an array of human-readable strings; empty means valid.
 */
export function collectRlsErrors(entitiesDir) {
  const errors = [];
  const files = readdirSync(entitiesDir).filter((f) => f.endsWith(".jsonc"));
  let businessScoped = 0;

  for (const file of files) {
    const entity = file.replace(/\.jsonc$/, "");
    let schema;
    try {
      schema = parseJsonc(readFileSync(join(entitiesDir, file), "utf8"));
    } catch (e) {
      errors.push(`${entity}: failed to parse JSONC — ${e.message}`);
      continue;
    }
    const rls = schema.rls;
    if (!rls) continue;

    for (const op of ["create", "read", "update", "delete"]) {
      if (!(op in rls)) continue;
      checkUserTemplates(rls[op], entity, op, errors);
      checkEntityKeys(rls[op], entity, op, errors);
    }

    // Tenant-scoped entities (have company_id) must filter read by
    // data.company_id == {{user.data.company_id}}. Platform-admin entities
    // that gate read behind role:admin (TenantRule, EmailNotification) are
    // exempt — they are not per-tenant readable.
    const hasBusinessId = schema.properties &&
      "company_id" in schema.properties;
    const adminGated = rls.read &&
      JSON.stringify(rls.read) === '{"user_condition":{"role":"admin"}}';
    if (hasBusinessId && rls.read && !adminGated) {
      businessScoped++;
      const readJson = JSON.stringify(rls.read);
      const adminBranch = '"user_condition":{"role":"admin"}';
      if (!readJson.includes('"data.company_id":"{{user.data.company_id}}"')) {
        errors.push(
          `${entity} [read]: tenant-scoped entity (has company_id) must ` +
            `filter read by {"data.company_id":"{{user.data.company_id}}"}.`,
        );
      }

      // READ side: the tenant equality above keeps end users isolated (an
      // almacenista never matches the admin branch), but the read rule must
      // ALSO carry the service-role branch. Backend "Safe" functions load a
      // record via base44.asServiceRole BEFORE acting on it, and asServiceRole
      // evaluates as role:admin with NO end-user context — so a read rule of
      // only {"data.company_id":"{{user.data.company_id}}"} resolves the user
      // template to empty and asServiceRole.filter() returns ZERO rows. The
      // function then sees "not found" and fails silently: marking a pedido
      // Entregado / converting / registering a payment does nothing, and
      // manageSession can never find the existing session so it creates a new
      // one on every heartbeat (duplicate Sessions). Same OR-branch as writes.
      if (!readJson.includes(adminBranch)) {
        errors.push(
          `${entity} [read]: tenant-scoped read rule must include the ` +
            `service-role branch {"user_condition":{"role":"admin"}} (e.g. ` +
            `{"$or":[{"data.company_id":"{{user.data.company_id}}"},` +
            `{"user_condition":{"role":"admin"}}]}). Backend reads go through ` +
            `base44.asServiceRole (role:admin, no end-user context); without ` +
            `this branch asServiceRole.filter() returns empty and Safe ` +
            `functions that read-then-write fail silently (deliver/convert/` +
            `payments do nothing; Sessions duplicate). End users stay isolated ` +
            `via the tenant equality — almacenistas never match role:admin.`,
        );
      }

      // WRITE side: create/update/delete must allow the service role. Backend
      // "Safe" functions perform every write via base44.asServiceRole, which
      // evaluates as role:admin and has NO end-user context — so a write rule
      // of only {"data.company_id":"{{user.data.company_id}}"} resolves the
      // user template to empty and rejects the write. The result is a silent,
      // app-wide write outage (every create/update/delete via a Safe function
      // fails) while reads keep working. The fix is the same OR-branch the
      // Session entity already uses: {"user_condition":{"role":"admin"}}.
      for (const op of ["create", "update", "delete"]) {
        if (!(op in rls)) {
          errors.push(
            `${entity} [${op}]: tenant-scoped entity must define a ${op} rule.`,
          );
          continue;
        }
        if (!JSON.stringify(rls[op]).includes(adminBranch)) {
          errors.push(
            `${entity} [${op}]: tenant-scoped write rule must include ` +
              `{"user_condition":{"role":"admin"}} (e.g. {"$or":[` +
              `{"data.company_id":"{{user.data.company_id}}"},` +
              `{"user_condition":{"role":"admin"}}]}). Backend writes go ` +
              `through base44.asServiceRole (role:admin, no end-user context); ` +
              `without this branch the user template resolves to empty and ` +
              `EVERY write via a Safe function fails silently.`,
          );
        }
      }
    }
  }

  return { errors, total: files.length, businessScoped };
}

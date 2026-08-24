#!/usr/bin/env node
/**
 * CLI guard against the multi-tenant RLS bug that took StockFlow down
 * (every tenant saw "cero items"). Parses every base44/entities/*.jsonc and
 * exits non-zero if any RLS rule uses a wrong entity- or user-side path.
 *
 *   npm run validate:rls
 *
 * The actual rules live in scripts/lib/entity-rls-rules.mjs. There is no
 * Deno test mirroring this in base44/ and no Deno step in .github/workflows/
 * ci.yml — this script (wired into `npm run lint`) is the only place these
 * rules run. Don't claim Deno coverage that doesn't exist; add it here and
 * to CI together if it's ever built.
 */

import process from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectRlsErrors } from "./lib/entity-rls-rules.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTITIES_DIR = join(__dirname, "..", "base44", "entities");

const { errors, total, businessScoped } = collectRlsErrors(ENTITIES_DIR);

if (errors.length > 0) {
  console.error(`\n✗ Entity RLS validation FAILED (${errors.length} issue(s)):\n`);
  for (const err of errors) console.error(`  - ${err}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Entity RLS validation passed (${total} entities, ` +
    `${businessScoped} tenant-scoped).`,
);

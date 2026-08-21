#!/usr/bin/env node
// Fans base44/functions/_shared/_permissions.ts out to one colocated copy per
// function that needs it — the same "one copy per function directory" shape
// _billingGuard.ts already has, because Deno functions can't import across
// directories.
//
// Run: node scripts/generate-function-permissions.mjs
// Checked by: node scripts/validate-permissions.mjs (wired into `npm run lint`)

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'base44', 'functions', '_shared', '_permissions.ts');

export const TARGET_FUNCTIONS = [
  'createEmployee',
  'createManagedRecord',
  'exportCompanyData',
  'resolveApprovalRequest',
  'updateAttendanceRecord',
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const fn of TARGET_FUNCTIONS) {
    const dir = path.join(ROOT, 'base44', 'functions', fn);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    copyFileSync(SOURCE, path.join(dir, '_permissions.ts'));
    console.log(`✅  base44/functions/${fn}/_permissions.ts actualizado`);
  }
  console.log(`   ${TARGET_FUNCTIONS.length} copias generadas desde _shared/_permissions.ts`);
}

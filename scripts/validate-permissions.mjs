#!/usr/bin/env node
// Two drift guards for Module 3, both blocking (`npm run lint`):
//
//  1. src/lib/permissionRegistry.js vs the AUTOGEN block in
//     base44/functions/_shared/_permissions.ts — the client and the server
//     must resolve every key identically. A copy nobody checks is a copy that
//     silently drifts, and the failure mode is the worst kind: the UI hides a
//     button the server still allows, or the server denies what the UI offers.
//  2. _shared/_permissions.ts vs each colocated copy under
//     base44/functions/<fn>/_permissions.ts — byte-identical, or a function is
//     enforcing a stale matrix. Regenerate with
//     `npm run generate:function-permissions`.
//
// Run: node scripts/validate-permissions.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TARGET_FUNCTIONS } from './generate-function-permissions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(ROOT, 'src', 'lib', 'permissionRegistry.js');
const SHARED = path.join(ROOT, 'base44', 'functions', '_shared', '_permissions.ts');

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`No se encontró "${marker}"`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`Bloque sin cerrar tras "${marker}"`);
}

// Client rows look like:
//   "Section:action": { [COMPANY_ADMIN]: true, [STORE_MANAGER]: false, ... },
// Server rows look like:
//   'Section:action': { company_admin: true, store_manager: false, ... },
const ROLE_TOKENS = {
  '[COMPANY_ADMIN]': 'company_admin',
  '[STORE_MANAGER]': 'store_manager',
  '[EMPLOYEE]': 'employee',
};

function parseMatrix(block, roleMap) {
  const out = {};
  for (const m of block.matchAll(/["']([A-Za-zÁÉÍÓÚÑáéíóúñ]+:[a-z_]+)["']:\s*\{([^}]*)\}/g)) {
    const roles = {};
    for (const part of m[2].split(',')) {
      const idx = part.lastIndexOf(':');
      if (idx === -1) continue;
      const rawRole = part.slice(0, idx).trim();
      const role = roleMap ? roleMap[rawRole] : rawRole.replace(/^["']|["']$/g, '');
      if (!role) continue;
      roles[role] = part.slice(idx + 1).trim() === 'true';
    }
    out[m[1]] = roles;
  }
  return out;
}

const errors = [];

const client = parseMatrix(
  blockAfter(readFileSync(REGISTRY, 'utf8'), 'export const PERMISSION_REGISTRY'),
  ROLE_TOKENS,
);
const sharedSource = readFileSync(SHARED, 'utf8');
const server = parseMatrix(blockAfter(sharedSource, 'const PERMISSION_REGISTRY'), null);

if (Object.keys(client).length === 0) errors.push('permissionRegistry.js se parseó vacío — revisa el parser.');
if (Object.keys(server).length === 0) errors.push('_shared/_permissions.ts se parseó vacío — revisa el parser.');

for (const key of Object.keys(client)) {
  if (!(key in server)) {
    errors.push(`Falta en _shared/_permissions.ts: "${key}"`);
    continue;
  }
  for (const role of Object.keys(client[key])) {
    if (client[key][role] !== server[key][role]) {
      errors.push(
        `Default distinto para "${key}" / ${role}: cliente=${client[key][role]} servidor=${server[key][role]}`,
      );
    }
  }
}
for (const key of Object.keys(server)) {
  if (!(key in client)) errors.push(`Sobra en _shared/_permissions.ts (no existe en el registry): "${key}"`);
}

// 2. colocated copies must be byte-identical to the canonical source.
for (const fn of TARGET_FUNCTIONS) {
  const copy = path.join(ROOT, 'base44', 'functions', fn, '_permissions.ts');
  if (!existsSync(copy)) {
    errors.push(`Falta la copia base44/functions/${fn}/_permissions.ts — corre npm run generate:function-permissions`);
    continue;
  }
  if (readFileSync(copy, 'utf8') !== sharedSource) {
    errors.push(`base44/functions/${fn}/_permissions.ts difiere de _shared/_permissions.ts — corre npm run generate:function-permissions`);
  }
}

if (errors.length) {
  console.error('✗ Permisos desincronizados:\n');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `✓ Permission validation passed (${Object.keys(client).length} claves, ${TARGET_FUNCTIONS.length} copias sincronizadas).`,
);

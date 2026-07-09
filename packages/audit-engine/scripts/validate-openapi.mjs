#!/usr/bin/env node
/**
 * validate-openapi.mjs — fails the build if openapi/openapi.json (the
 * canonical, GitHub-stored contract) doesn't parse, or if any file under
 * src/app/api/v1/**\/route.ts exists with no corresponding path entry in
 * the contract (the exact drift that broke onboarding: routes existed in
 * code but were never declared in the spec).
 *
 * Pure filesystem checks — no network calls, no dependency on this
 * engine (or any other) being deployed/reachable.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const specPath = path.join(ROOT, 'openapi', 'openapi.json');

if (!existsSync(specPath)) {
  console.error(`FAIL: ${specPath} does not exist. Every engine must commit a canonical openapi/openapi.json.`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
const declaredPaths = new Set(Object.keys(spec.paths ?? {}));

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry === 'route.ts' || entry === 'route.js') acc.push(full);
  }
}

const routeFiles = [];
const apiDir = path.join(ROOT, 'src', 'app', 'api');
if (existsSync(apiDir)) walk(apiDir, routeFiles);

function fileToPath(file) {
  const rel = path.relative(apiDir, file);
  const segments = rel.split(path.sep).slice(0, -1); // drop 'route.ts'
  const templated = segments.map((s) => (s.startsWith('[') ? `{${s.replace(/\[|\]/g, '').replace('...', '')}}` : s));
  return `/api/${templated.join('/')}`;
}

const missing = [];
for (const file of routeFiles) {
  const p = fileToPath(file);
  const found = [...declaredPaths].some((declared) => {
    const a = declared.replace(/\{[^}]+\}/g, '*').split('/');
    const b = p.replace(/\{[^}]+\}/g, '*').split('/');
    return a.length === b.length && a.every((seg, i) => seg === '*' || seg === b[i]);
  });
  if (!found) missing.push({ file: path.relative(ROOT, file), expectedPath: p });
}

if (missing.length > 0) {
  console.error('FAIL: routes exist in code with no matching entry in openapi/openapi.json (contract drift):');
  for (const m of missing) console.error(`  - ${m.file}  →  expected path ~ ${m.expectedPath}`);
  console.error('\nFix: add the missing path(s) to openapi/openapi.json.');
  process.exit(1);
}

console.log(`OK: ${routeFiles.length} route file(s) all have a matching entry in openapi/openapi.json.`);

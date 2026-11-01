#!/usr/bin/env node
// Golden-file lock: a catalog may grow, never shrink. Fails if any line present on the base
// ref is missing now. Pattern from vidanov/ai-ready-repo (deny catalog).
// Usage: node check-append-only.mjs <base-ref> <file>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [base, file] = process.argv.slice(2);
let before;
try { before = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' }); } catch {
  console.log(`check-append-only: ${file} not on ${base} yet`); process.exit(0);
}
const now = new Set(readFileSync(file, 'utf8').split('\n'));
const removed = before.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !now.has(l));
if (removed.length) {
  console.error(`check-append-only: ${removed.length} line(s) removed from ${file}:`);
  for (const l of removed) console.error(`  - ${l}`);
  process.exit(1);
}
console.log(`check-append-only: ${file} only grew`);

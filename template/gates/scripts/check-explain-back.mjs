#!/usr/bin/env node
// CI version of hooks/require-explain-back.mjs, so the rule holds for every agent:
// at learner level 1 and 2, no FIXLOG entry may still wait for the learner's explain-back.
import { existsSync, readFileSync } from 'node:fs';

const level = existsSync('docs/LEARNER.md')
  ? Number((readFileSync('docs/LEARNER.md', 'utf8').match(/^level:\s*(\d)/m) ?? [])[1] ?? 0)
  : 0;
if (level < 1 || !existsSync('docs/FIXLOG.md')) {
  console.log(`check-explain-back: level ${level}, nothing to check`);
  process.exit(0);
}
const pending = (readFileSync('docs/FIXLOG.md', 'utf8').match(/^Explain-back:\s*(TODO)?\s*$/gim) ?? []).length;
if (pending > 0) {
  console.error(`check-explain-back: ${pending} FIXLOG entr${pending === 1 ? 'y has' : 'ies have'} no explain-back yet.`);
  process.exit(1);
}
console.log('check-explain-back: every fix has an explain-back');

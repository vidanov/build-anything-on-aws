#!/usr/bin/env node
// Learning gate (levels 1 and 2): no `git push` while a FIXLOG entry still waits for the
// learner's explain-back. Claude Code PreToolUse hook on Bash. The same check runs in CI
// (gates/scripts/check-explain-back.mjs), so it also holds for agents without hooks.
import { existsSync, readFileSync } from 'node:fs';

let input = '';
try { input = readFileSync(0, 'utf8'); } catch { /* no stdin */ }
let command = '';
try { command = JSON.parse(input || '{}').tool_input?.command ?? ''; } catch { process.exit(0); }
if (!/\bgit\s+push\b/.test(command)) process.exit(0);

const level = existsSync('docs/LEARNER.md')
  ? Number((readFileSync('docs/LEARNER.md', 'utf8').match(/^level:\s*(\d)/m) ?? [])[1] ?? 0)
  : 0;
if (level < 1 || !existsSync('docs/FIXLOG.md')) process.exit(0);

const pending = readFileSync('docs/FIXLOG.md', 'utf8').match(/^Explain-back:\s*(TODO|$)/gim);
if (pending) {
  console.error(`require-explain-back: ${pending.length} FIXLOG entr${pending.length === 1 ? 'y waits' : 'ies wait'} for your explain-back.`);
  console.error('Write in your own words what failed and why the fix works, then push.');
  process.exit(2);
}
process.exit(0);

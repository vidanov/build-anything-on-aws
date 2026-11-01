#!/usr/bin/env node
// Blocks dangerous shell commands before a coding agent runs them.
// Claude Code: PreToolUse hook on Bash. Reads the hook JSON on stdin, exits 2 to block
//   (Claude Code shows stderr to the agent). Plain use: node hooks/deny-aws.mjs --check "<command>".
// No dependencies: Node only, so it works where jq is missing (fail closed, not open).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const patterns = readFileSync(join(here, 'deny-patterns.txt'), 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => {
    const [id, re, why] = l.split('\t');
    // POSIX classes from the file -> JS regex
    return { id, why, re: new RegExp(re.replaceAll('[[:space:]]', '\\s')) };
  });

export function check(command) {
  return patterns.filter((p) => p.re.test(command));
}

let command;
const i = process.argv.indexOf('--check');
if (i > -1) {
  command = process.argv[i + 1] ?? '';
} else {
  let input = '';
  try { input = readFileSync(0, 'utf8'); } catch { /* no stdin */ }
  try {
    const data = JSON.parse(input || '{}');
    command = data.tool_input?.command ?? data.command ?? '';
  } catch {
    console.error('deny-aws: could not parse hook input; blocking to stay safe.');
    process.exit(2);
  }
}

const hits = check(command);
if (hits.length > 0) {
  for (const h of hits) console.error(`deny-aws ${h.id}: blocked, ${h.why}.`);
  console.error('If this is really needed, a human runs it, or it goes through a pull request.');
  process.exit(2);
}
process.exit(0);

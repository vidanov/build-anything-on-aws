#!/usr/bin/env node
// Deletes App-pr-<n> stacks older than their ttlHours tag. Run by .github/workflows/sweeper.yml.
// Usage: node gates/scripts/sweep.mjs --region eu-central-1 [--dry-run]
import { execFileSync } from 'node:child_process';

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const region = arg('--region') ?? process.env.AWS_REGION;
const dry = process.argv.includes('--dry-run');

const stacks = JSON.parse(execFileSync('aws', ['cloudformation', 'describe-stacks', '--region', region, '--output', 'json'], { encoding: 'utf8' })).Stacks;
const now = Date.now();
let swept = 0;
for (const s of stacks) {
  if (!/^App-pr-\d+$/.test(s.StackName) || s.StackStatus.startsWith('DELETE')) continue;
  const tags = Object.fromEntries((s.Tags ?? []).map((t) => [t.Key, t.Value]));
  if (tags.ManagedBy !== 'baa') continue;
  const ttl = Number(tags.ttlHours ?? 48) * 3600 * 1000;
  const age = now - new Date(s.CreationTime).getTime();
  if (age < ttl) continue;
  const stage = s.StackName.replace(/^App-/, '');
  console.log(`${dry ? 'would delete' : 'deleting'} ${s.StackName} (age ${Math.round(age / 3600000)} h, ttl ${ttl / 3600000} h)`);
  if (!dry) execFileSync('npx', ['cdk', 'destroy', s.StackName, '-c', `baa:stage=${stage}`, '-c', `baa:region=${region}`, '--force'], { stdio: 'inherit' });
  swept++;
}
console.log(`sweep: ${swept} stack(s)`);

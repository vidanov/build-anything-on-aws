#!/usr/bin/env node
// Evidence record, written by CI. The agent never writes evidence: an oracle the agent can
// edit is not independent (VBA anchor independence). Format follows Shape's ProofTrace idea:
// gate, oracle class, decision, command, artifact hash, commit, run URL.
//
// Usage: node gates/scripts/evidence.mjs --out evidence.json [--deploy outputs.json]
// Evidence states: configured (file exists), executed (gate ran), demonstrated (deploy + smoke
// passed in a real account), unknown (could not tell).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const out = arg('--out') ?? 'evidence.json';
const deployFile = arg('--deploy');

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const template = existsSync('cdk.out') ? readdirSync('cdk.out').find((f) => /^App-.*\.template\.json$/.test(f)) : undefined;

const gates = existsSync('cdk.out/gates-result.json') ? JSON.parse(readFileSync('cdk.out/gates-result.json', 'utf8')) : null;
let deploy = null;
if (deployFile) {
  const smoke = existsSync('cdk.out/smoke-result.json') ? JSON.parse(readFileSync('cdk.out/smoke-result.json', 'utf8')) : null;
  deploy = {
    outputs: existsSync(deployFile) ? JSON.parse(readFileSync(deployFile, 'utf8')) : null,
    smoke,
  };
}

const state = deploy?.smoke?.ok ? 'demonstrated' : gates ? (gates.results.every((r) => r.status === 'pass' || !r.blocking) ? 'executed' : 'executed-red') : 'unknown';

const record = {
  schema: 'baa-evidence/1',
  state,
  stage: process.env.BAA_STAGE ?? gates?.stage ?? null,
  commit: process.env.GITHUB_SHA ?? null,
  ref: process.env.GITHUB_REF ?? null,
  run: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  actor: process.env.GITHUB_ACTOR ?? null,
  writtenBy: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local (not evidence)',
  template: template ? { file: template, sha256: sha256(join('cdk.out', template)) } : null,
  gates: gates?.results ?? [],
  deploy,
  at: new Date().toISOString(),
};

writeFileSync(out, JSON.stringify(record, null, 2));
console.log(`evidence: ${state} -> ${out}`);

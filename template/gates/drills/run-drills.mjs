#!/usr/bin/env node
// Drills prove that each gate can fail. Each drill plants one known violation and expects
// its gate to go red. If a drill comes back green, the gate is broken, and this script fails.
// Run from the project root after `npm run synth`: node gates/drills/run-drills.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const templateFile = readdirSync('cdk.out').find((f) => /^App-.*\.template\.json$/.test(f));
if (!templateFile) {
  console.error('run-drills: synth first (npm run synth).');
  process.exit(2);
}
const base = JSON.parse(readFileSync(join('cdk.out', templateFile), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'baa-drill-'));

const firstOf = (t, type) => Object.values(t.Resources).find((r) => r.Type === type);

// Each guard drill: name, rule file, stage, mutation of a copy of the clean template.
const guardDrills = [
  ['bucket-public-access-off', 'secure-defaults', 'pr', (t) => { firstOf(t, 'AWS::S3::Bucket').Properties.PublicAccessBlockConfiguration.BlockPublicPolicy = false; }],
  ['bucket-without-encryption', 'secure-defaults', 'pr', (t) => { delete firstOf(t, 'AWS::S3::Bucket').Properties.BucketEncryption; }],
  ['bucket-policy-allows-http', 'secure-defaults', 'pr', (t) => { const p = firstOf(t, 'AWS::S3::BucketPolicy'); p.Properties.PolicyDocument.Statement = p.Properties.PolicyDocument.Statement.filter((s) => s.Effect !== 'Deny'); }],
  ['table-without-pitr', 'secure-defaults', 'pr', (t) => { delete firstOf(t, 'AWS::DynamoDB::Table').Properties.PointInTimeRecoverySpecification; }],
  ['logs-kept-forever', 'secure-defaults', 'pr', (t) => { delete firstOf(t, 'AWS::Logs::LogGroup').Properties.RetentionInDays; }],
  ['open-function-url', 'secure-defaults', 'pr', (t) => { t.Resources.DrillUrl = { Type: 'AWS::Lambda::Url', Properties: { AuthType: 'NONE', TargetFunctionArn: 'arn:aws:lambda:eu-central-1:111111111111:function:x' } }; }],
  ['nat-gateway', 'cost-allowlist', 'pr', (t) => { t.Resources.DrillNat = { Type: 'AWS::EC2::NatGateway', Properties: { SubnetId: 'subnet-1' } }; }],
  ['provisioned-table', 'cost-allowlist', 'pr', (t) => { firstOf(t, 'AWS::DynamoDB::Table').Properties.BillingMode = 'PROVISIONED'; }],
  ['unlisted-public-route', 'public-routes', 'pr', (t) => { t.Resources.DrillRoute = { Type: 'AWS::ApiGatewayV2::Route', Properties: { ApiId: 'x', RouteKey: 'DELETE /visits', AuthorizationType: 'NONE' } }; }],
  ['pr-stack-retains-data', 'stage-removal', 'pr', (t) => { firstOf(t, 'AWS::DynamoDB::Table').DeletionPolicy = 'Retain'; }],
  ['prod-deletes-data', 'stage-removal', 'prod', (t) => { /* the clean PR template deletes data, which is wrong for prod */ }],
];

const nagDrills = ['wildcard-action', 'bucket-without-tls'];

let broken = 0;
const report = (name, gate, red) => {
  console.log(`${red ? 'ok    ' : 'BROKEN'} drill ${name} -> ${gate} ${red ? 'went red' : 'stayed green'}`);
  if (!red) broken++;
};

for (const [name, rule, stage, mutate] of guardDrills) {
  const t = structuredClone(base);
  mutate(t);
  const file = join(work, `${name}.json`);
  const params = join(work, `${name}.params.json`);
  writeFileSync(file, JSON.stringify(t));
  writeFileSync(params, JSON.stringify({ baa_stage: stage }));
  const r = spawnSync('cfn-guard', ['validate', '-r', `gates/guard/${rule}.guard`, '-d', file, '--input-params', params, '-S', 'none'], { encoding: 'utf8' });
  report(name, `guard:${rule}`, r.status !== 0);
}

for (const name of nagDrills) {
  const out = join(work, `nag-${name}`);
  spawnSync('npx', ['ts-node', 'gates/drills/nag-drill.ts', name, out], { encoding: 'utf8' });
  let red = false;
  try { execFileSync('node', ['gates/scripts/nag-report.mjs', out], { stdio: 'ignore' }); } catch { red = true; }
  report(name, 'cdk-nag', red);
}

if (broken > 0) {
  console.error(`run-drills: ${broken} gate(s) could not fail. Fix the gate before trusting it.`);
  process.exit(1);
}
console.log('run-drills: every gate failed on its planted violation.');

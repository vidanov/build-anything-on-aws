#!/usr/bin/env node
// Native oracle over CDK policy validation (cdk-nag v3 and CDK's own CloudFormation Validate).
// Reads the reports in cdk.out and fails on any unacknowledged error, whatever `cdk synth`
// returned. Prints each finding with the construct path and how to acknowledge it, so
// explain-fail can turn it into a lesson.
//
// Usage: node gates/scripts/nag-report.mjs [cdk.out] [--json]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'cdk.out';
const asJson = process.argv.includes('--json');

const files = ['policy-validation-report.json', 'validation-report.json']
  .map((f) => join(dir, f))
  .filter((f) => existsSync(f));

if (files.length === 0) {
  console.error(`nag-report: no validation report in ${dir}. Run cdk synth first. Treating as failure.`);
  process.exit(2);
}

const findings = [];
for (const file of files) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  for (const plugin of report.pluginReports ?? []) {
    const pluginName = plugin.pluginName ?? plugin.summary?.pluginName ?? 'unknown';
    for (const v of plugin.violations ?? []) {
      const where = (v.violatingResources ?? v.violatingConstructs ?? []).map((r) => r.constructPath ?? r.resourceLogicalId ?? r.constructStack?.path).filter(Boolean);
      findings.push({
        plugin: pluginName,
        rule: v.ruleName,
        severity: (v.severity ?? 'error').toLowerCase(),
        description: (v.description ?? '').split('. ')[0],
        fix: v.suggestedFix,
        where: [...new Set(where)],
      });
    }
  }
}

// Same finding can appear in both report files; keep one.
const seen = new Set();
const unique = findings.filter((f) => {
  const key = `${f.plugin}|${f.rule}|${f.where.join(',')}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const errors = unique.filter((f) => f.severity === 'error');
const warnings = unique.filter((f) => f.severity !== 'error');

if (asJson) {
  console.log(JSON.stringify({ errors, warnings }, null, 2));
} else {
  for (const f of [...errors, ...warnings]) {
    console.log(`${f.severity.toUpperCase()} ${f.rule} (${f.plugin})`);
    console.log(`  ${f.description}`);
    for (const w of f.where) console.log(`  at ${w}`);
    if (f.fix) console.log(`  fix: ${f.fix}`);
    console.log(`  acknowledge only with a reason: Validations.of(construct).acknowledge({ id: '${f.rule}', reason: '...' })`);
  }
  console.log(`nag-report: ${errors.length} error(s), ${warnings.length} warning(s)`);
}

process.exit(errors.length > 0 ? 1 : 0);

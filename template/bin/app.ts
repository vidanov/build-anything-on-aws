#!/usr/bin/env node
// Entry point. One app, one stack per stage: App-pr-12, App-dev, App-prod.
// Stage and region come from context so CI decides them, not the agent:
//   cdk synth -c baa:stage=pr-12 -c baa:region=eu-central-1
import { App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks, ServerlessChecks } from 'cdk-nag';
import { AppStack } from '../lib/app-stack';
import { readSettings } from '../lib/settings';

const app = new App();
const settings = readSettings(app);

new AppStack(app, `App-${settings.stage}`, {
  settings,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: settings.region },
  description: `${settings.project} (${settings.stage}) built with Build Anything on AWS`,
});

Tags.of(app).add('Project', settings.project);
Tags.of(app).add('Stage', settings.stage);
Tags.of(app).add('ManagedBy', 'baa');

// cdk-nag v3 runs as a CDK policy validation plugin and writes
// cdk.out/policy-validation-report.json. gates/scripts/nag-report.mjs reads
// that report and fails the build on any unacknowledged finding, so the gate
// does not depend on the exit code of `cdk synth`.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
Validations.of(app).addPlugins(new ServerlessChecks(app, { verbose: true }));

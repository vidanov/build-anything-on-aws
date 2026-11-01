// Drill for the cdk-nag gate: plant a known violation, synth with the same nag packs as
// bin/app.ts, and expect the gate to fail. A gate that cannot fail is not a gate.
// Usage (from the project root): npx ts-node gates/drills/nag-drill.ts <drill> <outdir>
import { App, Validations, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { AwsSolutionsChecks, ServerlessChecks } from 'cdk-nag';
import { AppStack } from '../../lib/app-stack';
import { readSettings } from '../../lib/settings';

const [drill, outdir] = process.argv.slice(2);
const app = new App({ outdir, context: { 'baa:stage': 'pr-0', '@aws-cdk/core:validationReportJson': true } });
const stack = new AppStack(app, 'App-pr-0', { settings: readSettings(app), env: { region: 'eu-central-1' } });

switch (drill) {
  case 'bucket-without-tls':
    new s3.Bucket(stack, 'DrillBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL });
    break;
  case 'wildcard-action':
    new iam.Role(stack, 'DrillRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') })
      .addToPolicy(new iam.PolicyStatement({ actions: ['*'], resources: ['*'] }));
    break;
  default:
    throw new Error(`unknown nag drill ${drill}`);
}

Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
Validations.of(app).addPlugins(new ServerlessChecks(app));
try {
  app.synth();
} catch {
  // A failed validation may throw; the report on disk is what the gate reads.
}

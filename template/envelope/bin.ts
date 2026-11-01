#!/usr/bin/env node
// The envelope app. A human runs it once, with admin rights, before cdk bootstrap:
//   npm run envelope:deploy -- -c profile=B -c githubOwner=me -c githubRepo=my-app -c alertEmail=me@example.com
// The local coding agent cannot run this: deny-aws blocks cdk deploy, and its role is read-only.
import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib';
import { EnvelopeProfile, EnvelopeStack } from './envelope-stack';

const app = new App();
const ctx = (key: string, fallback?: string): string => {
  const v = app.node.tryGetContext(key) ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing context: -c ${key}=...`);
  return String(v);
};

const region = ctx('region', process.env.CDK_DEFAULT_REGION ?? 'eu-central-1');
const profile = ctx('profile', 'B') as EnvelopeProfile;
if (!['A', 'B', 'C'].includes(profile)) throw new Error('profile must be A, B or C (see envelope/profiles/)');

new EnvelopeStack(app, 'BaaEnvelope', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  // No bootstrap needed: the envelope has no assets and deploys with the human's credentials.
  synthesizer: new CliCredentialsStackSynthesizer(),
  terminationProtection: true,
  profile,
  githubOwner: ctx('githubOwner'),
  githubRepo: ctx('githubRepo'),
  githubOwnerId: app.node.tryGetContext('githubOwnerId'),
  githubRepoId: app.node.tryGetContext('githubRepoId'),
  alertEmail: ctx('alertEmail'),
  monthlyBudgetUsd: Number(ctx('monthlyBudgetUsd', '20')),
  // us-east-1 stays allowed for CloudFront-related calls that land there.
  allowedRegions: [...new Set([region, 'us-east-1'])],
  trail: ctx('trail', 'true') !== 'false',
});

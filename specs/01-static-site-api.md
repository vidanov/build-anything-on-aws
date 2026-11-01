# 01 Static site with an API

version: 1
personal-data: no (M1). M2 adds sign-in before any personal data is stored.
template: `template/` (CDK TypeScript, cdk-nag v3, Guard rules, drills)

## Brief

A static site with a visit counter. CloudFront serves the page from a private S3 bucket
through Origin Access Control. An HTTP API with one Lambda function answers `GET /health`
and `POST /visits`, and the count lives in DynamoDB. Same learning scope as the Cloud Resume
Challenge (IAM, CDN, IaC, CI/CD, tests); what is new is the gates and the learning layer.

## Fits when

- The learner wants something public and small online, with a little backend.
- Traffic is low or unknown; cost must be near zero when idle.

## Does not fit when

- It must store personal data in M1 (take M2 first: Cognito sign-in).
- It needs a custom domain in profile A (the certificate would have to live in us-east-1).
- It needs long-running work (minutes), queues or files uploaded by users (later blueprints).

## How it works

One CDK app builds `App-<stage>` (`pr-<n>`, `dev`, `prod`) from four constructs:
`Frontend` (S3, CloudFront, logs bucket, site deployment with `config.json`), `Api` (HTTP API with
throttling and access logs, one Node.js 24 ARM function with an explicit role), `Data` (on-demand
table with point-in-time recovery), `Ops` (SNS topic, alarms on Lambda errors and API 5xx).
The envelope (once per account) holds the permissions boundary, CloudFormation execution
policy, GitHub OIDC roles, agent role, budget and trail. Region is a parameter.

Gates, in this order: `tsc`, jest template tests, handler tests, `cdk synth` with cdk-nag
(AwsSolutions, Serverless), `nag-report`, cfn-lint, cfn-guard (secure defaults, cost allowlist,
stage removal, public routes). Drills prove each gate can fail.

## Stories (M1)

| ID | Story | Checks |
|---|---|---|
| S-001 | The page opens over the CloudFront URL; the bucket is not public | `[unit]` OAC and Block Public Access, `[policy]` secure-defaults, `[deploy]` 200 over HTTPS |
| S-002 | `GET /health` answers 200 | `[unit]` handler, `[deploy]` smoke |
| S-003 | `POST /visits` counts up in DynamoDB | `[unit]`, `[policy]` PITR and on-demand, `[deploy]` two POSTs count up |
| S-004 | Each public route has an ADR and is throttled | `[policy]` public-routes, `[unit]` throttle, `[manual]` ADR accepted in the PR |
| S-005 | Budget alerts arrive by email | `[unit]` envelope test, `[manual]` subscription confirmed |
| S-006 | Alarms for Lambda errors and API 5xx exist | `[unit]`, `[deploy]` |
| S-007 | The PR shows green gates, the `cdk diff` comment and the learner's prediction | `[policy]`, `[manual]` FIXLOG line on the gap |
| S-008 | `App-pr-<n>` comes up, passes smoke, and is deleted when the PR closes | `[deploy]`, `[cost]` nothing left behind |
| S-009 | Prod deploys only through the environment `prod` with a reviewer | `[deploy]`, `[manual]` |

The template already implements S-001 to S-006 and S-008. The learner's M1 work is to
understand, change and own it: each story is still one PR with a prediction.

M2 adds a Cognito JWT authorizer and, in profiles B and C only, a custom domain.

## Gotchas

- Region is a parameter from the first commit (profile A projects in Germany get eu-north-1).
- L2 constructs RETAIN stateful resources by default; `stage-removal.guard` keeps PR stacks clean.
- cdk-nag v3 has no bulk acknowledgement: every finding is acknowledged by its exact ID, with
  a reason, next to the code. `cdk synth` exits 1 on an unacknowledged error (verified with
  cdk-nag 3.0.2 and aws-cdk-lib 2.275.0); `nag-report.mjs` reads the report anyway.
- A construct child with the id `Default` takes over its parent's logical ID. The HTTP API
  stage is called `Stage` for that reason.
- BucketDeployment brings a CDK-owned helper Lambda; its findings are acknowledged in one
  function in `lib/app-stack.ts`. Our own function gets no such pass.
- New repositories get immutable OIDC subjects; the envelope trusts both formats when the
  numeric IDs are given.
- Fork PRs get no OIDC token and are never deployed.

## Done when

Every M1 story is `done` with a CI run URL or `blocked` with a reason; the drills prove each
gate can fail; `docs/LEARNER.md` has at least one check with a real answer per topic touched;
`docs/review/M1.md` is signed by a human.

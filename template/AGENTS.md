# Agent guidance

This project was built with Build Anything on AWS: blueprint 01-static-site-api, CDK TypeScript.
Read `docs/BRIEF.md` for what it is for and `docs/LEARNER.md` for how much to help.

## Commands

| Task | Command |
|---|---|
| All gates (what CI runs) | `npm run gates` |
| Prove every gate can still fail | `npm run drills` |
| Gates and drills | `npm run verify` |
| Template and envelope tests | `npx jest` |
| Handler tests | `node --test test/handler.test.mjs` |
| Synthesize a stage | `npx cdk synth -c baa:stage=pr-1` |
| Gates for the prod shape | `BAA_STAGE=prod npm run gates` |

## Work order

1. One story at a time from `docs/STORIES.md`; one story is one pull request.
2. Before code: write the prediction (resources, IAM, cost) into the PR description.
3. Load the Agent Toolkit for AWS skill for the service before writing AWS code.
4. Run `npm run gates` while changing code; run `npm run verify` before claiming completion.
5. A red gate: explain-fail first (hypothesis before fix at level 1 and 2), then fix the code.

## Architecture and constraints

- `bin/app.ts` builds `App-<stage>` and adds cdk-nag v3 (AwsSolutions, Serverless).
- `lib/` has one construct per concern: `frontend.ts`, `api.ts`, `data.ts`, `ops.ts`. Stage
  and region come from context (`lib/settings.ts`), never hard-coded.
- `envelope/` is the account envelope, deployed once by a human. It is not part of the app.
- Never weaken a gate, a Guard rule, a cdk-nag pack or a test to make a check pass.
  An acknowledgement needs a reason a reviewer accepts, next to the code it excuses.
- Never add a resource type that is not in `gates/guard/cost-allowlist.guard`.
- Secrets: by name only (SSM Parameter Store SecureString). Never read or print values,
  never paste them into the chat.

## Boundaries: ask before modifying

- `gates/`, `.github/`, `envelope/`, `cdk.json`, `docs/adr/`: human review (CODEOWNERS).
- Deploys and deletes: only through a pull request and GitHub Actions. The agent does not run
  `cdk deploy` or `cdk destroy`; its AWS role is read-only.

The commands enforce checks when they run. They do not enforce that an agent read the brief,
followed this order, or reported its work accurately.

## Completion evidence

Before claiming a story is done:

1. `npm run verify` passes locally; report the commands and exit codes.
2. The PR's CI run is green: gates, drills, `App-pr-<n>` deployed, smoke test passed.
3. Paste the CI run URL into the story in `docs/STORIES.md`.
4. State what could not be verified.

# Build Anything on AWS

**From vibe-coder to AWS developer.** Agent skills that take an idea to a deployed AWS system
that is gated, cheap to leave running, and understood by the person who built it.

Your coding agent already knows AWS: the [Agent Toolkit for AWS](https://github.com/aws/agent-toolkit-for-aws)
gives it the service knowledge. What it does not give you is a path, checks that hold when the
agent is wrong, an account where mistakes cannot get expensive, and a way to actually learn.
This repo adds those four things and nothing else.

```
preflight -> envelope -> aws-brief -> blueprint -> user-stories -> scaffold -> pipeline
          -> improve-loop (one story per PR: predict, code, gates, explain-fail, deploy pr-N)
          -> wa-checkpoint + debrief at the end of each milestone
```

Status: 0.1.0, first blueprint ready. Tested locally (synth, 20 template and envelope tests,
13 drills, 34 hook tests). Not yet run end to end against a real AWS account: see
[docs/FACT-CHECKS.md](docs/FACT-CHECKS.md).

## Quick start

Claude Code:

```
/plugin marketplace add aws/agent-toolkit-for-aws
/plugin install aws-core@agent-toolkit-for-aws
/plugin marketplace add vidanov/build-anything-on-aws
/plugin install build-anything-on-aws@build-anything-on-aws
```

Then type `/baa`. It reads your project and picks the next step.

Other agents (Codex, Cursor, Kiro): `scripts/link-skills.sh`, plus the MCP config for your
agent from [mcp/](mcp/) and the rules from [rules/](rules/).

Tools on your machine: Node.js 22+, AWS CLI 2.35+, GitHub CLI, `uv`, `cfn-lint`, `cfn-guard` 3.x.

## What makes it different

**The agent never deploys.** The local agent gets a read-only AWS role. Deploys and deletes
go through a pull request and GitHub Actions with OIDC (no keys anywhere). A deny hook with 26
tested patterns blocks `cdk deploy`, secret reads and dangerous AWS CLI calls, but the real
lock is IAM.

**Gates run outside the agent.** `npm run gates` is the same for the agent, the learner and
CI: TypeScript, template tests, cdk-nag v3 (AwsSolutions, Serverless), cfn-lint and four
cfn-guard rule sets (secure defaults, a cost allowlist of resource types, removal policy by
stage, listed public routes). In a PR, CI runs the gates from the base branch, so a PR cannot
weaken the checks that judge it.

**Every gate proves it can fail.** `npm run drills` plants one violation per gate (a public
bucket, a NAT gateway, `Action: "*"`, a PR stack that keeps its data, ...) and fails if any
gate stays green.

**The account is the safety net.** The envelope puts a permissions boundary on every role CDK
creates (region lock, no NAT gateways, no large instances, no IAM users or keys, audit stays
on), replaces AdministratorAccess in `cdk bootstrap` with a narrow execution policy, and sets a
budget with email alerts. BAA bootstraps its own toolkit stack (`BaaToolkit`, qualifier `baa`),
so an account that other CDK projects already bootstrapped keeps working as before. Three profiles, because the AWS sign-up path decides what is possible:

| Profile | For | Region | Preventive layer |
|---|---|---|---|
| [A](template/envelope/profiles/A-project.md) | new AWS sign-up (projects, since Sep 2026) | assigned by country (DE: eu-north-1) | AWS-managed SCPs + boundary |
| [B](template/envelope/profiles/B-classic.md) | classic single account | eu-central-1 | boundary only (joining Organizations moves a Free plan to Paid) |
| [C](template/envelope/profiles/C-team.md) | team or business unit | your choice | your SCPs + boundary |

**It teaches, and checks that the learning happened.** In a controlled study by Anthropic
(Jan 2026), people who learned a library with AI help scored 17% lower, with debugging hit
hardest, unless they asked for explanations. So the learner predicts the `cdk diff` before
CI shows it, states a hypothesis before a red gate is fixed, and writes an explain-back before
the push. Levels are per topic and move up only on checks with a real answer.

| Level | Who writes the fix | Agent |
|---|---|---|
| 0 | the agent | fixes, explains, asks one or two questions |
| 1 | the learner, at `TODO(human)` | frames, waits, gives hints |
| 2 | the learner | reviews only |

## Skills

| Stage | Skill | What it does |
|---|---|---|
| Start | [`baa`](skills/start/baa/SKILL.md) | Router: finds where you are and calls the right skill |
| | [`preflight`](skills/start/preflight/SKILL.md) | Tools, sign-in, account profile, starting level |
| | [`envelope`](skills/start/envelope/SKILL.md) | Boundary, execution policy, OIDC roles, agent role, budget |
| Plan | [`aws-brief`](skills/plan/aws-brief/SKILL.md) | Interview adapted from Matt Pocock's grilling, shaped by level |
| | [`blueprint`](skills/plan/blueprint/SKILL.md) | Pick a tested blueprint, managed service before code |
| | [`user-stories`](skills/plan/user-stories/SKILL.md) | Stories whose checks name their oracle |
| Build | [`scaffold`](skills/build/scaffold/SKILL.md) | The CDK project, green gates before the first commit |
| | [`improve-loop`](skills/build/improve-loop/SKILL.md) | One story per PR, done only on CI evidence |
| Ship | [`pipeline`](skills/ship/pipeline/SKILL.md) | GitHub wired to the envelope, proven by one PR |
| | [`ephemeral`](skills/ship/ephemeral/SKILL.md) | Throwaway `App-pr-<n>` stacks, cleanup and sweeper |
| | [`wa-checkpoint`](skills/ship/wa-checkpoint/SKILL.md) | Well-Architected review; findings become stories or gates |
| Learn | [`explain-fail`](skills/learn/explain-fail/SKILL.md) | A red gate becomes a lesson, hypothesis first |
| | [`level`](skills/learn/level/SKILL.md) | Per-topic levels, promotion on evidence |
| | [`debrief`](skills/learn/debrief/SKILL.md) | Milestone recall, confidence vs accuracy, transfer task |

## Blueprints

| Spec | Status |
|---|---|
| [01-static-site-api](specs/01-static-site-api.md): CloudFront + private S3 (OAC), HTTP API, Lambda, DynamoDB | ready, template in [template/](template/) |
| 02-bedrock-chat | planned |
| 03-media-pipeline | planned (Paid plan only) |

## Layout

```
skills/          14 skills (Agent Skills format, Claude Code plugin, Codex openai.yaml)
output-styles/   baa-l0, baa-l1, baa-l2 (Claude Code)
hooks/           deny-aws (26 patterns, tested), require-explain-back
mcp/             AWS MCP Server configs: pinned proxy, eu-central-1, read-only agent profile
rules/           rules for agents without the plugin, Kiro steering
specs/           blueprints
template/        the learner's project: CDK app, gates, drills, envelope, workflows, docs
docs/            FACT-CHECKS.md: what is verified and what is not
scripts/         validate-skills, link-skills, fact-checks (sandbox)
```

## Credits

Built on patterns from bama, Matt Pocock's skills, Ponytail, superpowers, Addy Osmani's
agent-skills, David Ondrej's skills, caveman, REA, and the author's ai-ready-repo,
least-privilege-cicd and quarterdeck. Details and licenses in [NOTICE.md](NOTICE.md).
Do not install superpowers next to this plugin: both want to own the process.

Not affiliated with or endorsed by Amazon Web Services. MIT license.

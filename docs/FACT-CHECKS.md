# Fact checks

The design rests on facts that change fast or that no source fully confirmed. Each one is
marked: **verified** (with how and when), **open** (run `scripts/fact-checks.sh` in a sandbox
account), or **assumption** (design choice to revisit). Last update: 2026-11-01.

| # | Fact | Status | Evidence or how to check | Depends on it |
|---|---|---|---|---|
| F1 | `cdk synth` exits non-zero on an unacknowledged cdk-nag v3 error | **verified** 2026-11-01 | cdk-nag 3.0.2, aws-cdk-lib 2.275.0, aws-cdk 2.1147.0: exit 1, report in `cdk.out/policy-validation-report.json`. `nag-report.mjs` reads the report anyway | first gate |
| F2 | cdk-nag v3 acknowledges each finding by exact ID, no prefix match | **verified** 2026-11-01 | README of 3.0.2; acknowledging `AwsSolutions-IAM5` did not cover `AwsSolutions-IAM5[Resource::*]` | `lib/app-stack.ts` |
| F3 | The permissions boundary context puts the boundary on every CDK role, custom resource roles included | **verified** 2026-11-01 | `@aws-cdk/core:permissionsBoundary` in `cdk.json`; jest test "every role carries the baa permissions boundary" | envelope contract |
| F4 | Every Guard rule and cdk-nag gate can fail | **verified** 2026-11-01 | `npm run drills`: 13 of 13 drills red | all gates |
| F5 | `aws:ViaAWSMCPService` (bool) marks calls made through the AWS MCP Server | open | check 1 in `scripts/fact-checks.sh` | agent-vs-human policies |
| F6 | `aws:CalledViaAWSMCP` holds the service principal (Security Blog), not `"true"` (lab page) | open | check 2 | same |
| F7 | `--read-only` on mcp-proxy-for-aws hides write tools in Claude Code, Codex, Cursor, Kiro | open | list tools in each client | read-only agent |
| F8 | The eu-central-1 MCP endpoint serves a profile A project in eu-north-1 with `--metadata AWS_REGION=eu-north-1` | open | check 3 in a project account | MCP in profile A |
| F9 | The AWS-managed project SCP (`RegionFloor`) allows `iam:CreateOpenIDConnectProvider` and `cdk bootstrap` | open | deploy the envelope in a test project | profile A |
| F10 | Germany maps to eu-north-1 in the new sign-up | open (docs list from 2026-08-18) | sign up a test project with a German address | profile A default |
| F11 | Joining or creating AWS Organizations moves a Free plan account to Paid | per AWS docs, not tested | AWS Free Tier plans page | profile B has no SCPs |
| F12 | Conditional `iam:CreateRole` (boundary must match) works for all roles CDK creates | partly verified | template synth shows the boundary on all roles; the real deploy is check 4 | envelope |
| F13 | `cdk diff` needs the lookup role or the deploy role | open | CloudTrail during a PR run | `baa-gha-pr` permissions |
| F14 | GitHub `sub` for `pull_request` events, classic and immutable formats | open | CloudTrail `AssumeRoleWithWebIdentity` from the first PR | OIDC trust |
| F15 | AWS Security Agent available in eu-central-1 | open | service regions page | optional gate |
| F16 | Agent Toolkit skills keep their names (no changelog or rename policy) | assumption | preflight records installed skills; compare on each run | routing by name |
| F17 | Free plan accounts can use Budgets alerts | per AWS docs | budget emails arrive | money stop in profile B |
| F18 | AWS Agent Toolkit `aws-core` plugin has 25 skills, v1.2.0 | verified 2026-11-01 (repo HEAD 2026-10-30) | `plugins/aws-core/plugin.json` | dependency |

Rule: a fact moves to **verified** only with a dated command output or CI run. Remove the
fact from this table when the design no longer depends on it.

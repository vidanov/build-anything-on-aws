---
name: envelope
description: Sets up the account envelope for a Build Anything on AWS project, the permissions boundary, CloudFormation execution policy, GitHub OIDC roles, read-only agent role, budget and trail, by preparing the commands a human runs once with admin rights.
---

# Envelope

Safety in this project does not depend on what the agent does. It comes from the account: a permissions boundary on every role, a CloudFormation execution policy instead of AdministratorAccess, GitHub OIDC instead of keys, a read-only role for the agent, and a budget that emails before money is gone.

The agent prepares; a human runs. `cdk deploy` and `cdk bootstrap` here need admin rights once, and the deny hook blocks the agent from running them.

## 1. Read the profile

Open the profile file named in `.baa/preflight.json` (`envelope/profiles/A-project.md`, `B-classic.md` or `C-team.md`) and follow it. Explain in two or three sentences what the profile can and cannot protect, in the learner's words.

## 2. Collect the inputs

- GitHub owner and repository name. For repos created or renamed after 2026-07-15 also the numeric IDs: `gh api repos/<owner>/<repo> --jq '.owner.id, .id'`.
- Alert email for budget and alarms.
- Monthly budget in USD. The budget counts the whole account. A new account takes the default 20. In an account that already runs other things, ask the human to read last month's cost first (their admin sign-in; the agent role does not exist yet): `aws ce get-cost-and-usage --time-period Start=<first day of last month>,End=<first day of this month> --granularity MONTHLY --metrics UnblendedCost`. Budget = that cost plus 20, rounded up. A budget below what the account already spends sends every alert in the first week, and the learner learns to ignore them.
- Region from `.baa/preflight.json`.

## 3. Write the wizard

Write `scripts/setup-envelope.sh`: one step per block, each step echoes what it does and why, then runs one command, then checks the result. Steps:

1. `aws sts get-caller-identity` (the human is signed in with admin rights)
2. `npm run envelope:deploy -- -c profile=<P> -c region=<R> -c githubOwner=<o> -c githubRepo=<r> [-c githubOwnerId=<id> -c githubRepoId=<id>] -c alertEmail=<e> -c monthlyBudgetUsd=<n> [-c trail=false]` (`trail=false` when an organization trail already records the account)
3. The `BootstrapCommand` from the stack outputs (own `BaaToolkit` stack with qualifier `baa`, narrow execution policy, `--custom-permissions-boundary baa-boundary`, termination protection)
4. `gh variable set AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_ROLE_PR`, `AWS_ROLE_DEV`, `ALERT_EMAIL`, and `gh variable set AWS_ROLE_PROD --env prod`
5. The `[profile baa-agent]` block for `~/.aws/config` with the `AgentRoleArn` output
6. `AWS_PROFILE=baa-agent aws sts get-caller-identity` (the agent role works and is not the admin)

Show the script. The human runs it. While they do, show only the current step and at most eight remaining step titles.

## 4. Confirm with evidence

After the run, check read-only (as `baa-agent`):

- `aws iam get-policy --policy-arn arn:aws:iam::<acct>:policy/baa-boundary`
- `aws cloudformation describe-stacks --stack-name BaaToolkit` shows the custom execution policy and qualifier `baa`
- `aws budgets describe-budgets --account-id <acct>` lists `baa-monthly`

Write `docs/ENVELOPE.md`: profile, region, role ARNs, what was confirmed, and what is still unverified for this profile (see `docs/FACT-CHECKS.md`). Set `status: ready`.

## If something fails

An AccessDenied from an SCP in profile A means the AWS-managed project policy blocks it. Record the exact error in `docs/ENVELOPE.md`, then offer profile B. Do not try another way around the SCP.

## Done when

`docs/ENVELOPE.md` says `status: ready`, each item in it has a read-only check behind it, and the learner can say in one sentence what the boundary stops.

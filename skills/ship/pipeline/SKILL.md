---
name: pipeline
description: Connects the learner's GitHub repository to AWS for a Build Anything on AWS project, repo variables, the prod environment, branch protection and CODEOWNERS where the GitHub plan allows them, and proves it with a first pull request that deploys a throwaway stack.
---

# Pipeline

The workflows ship with the template (`.github/workflows/`). This step wires GitHub to the envelope and proves the path end to end.

## 1. What the workflows do

Explain each in one line before setting anything:

- `pr.yml`: gates from the base branch (a PR cannot weaken the gates that judge it), drills, `cdk diff` as a PR comment next to the learner's prediction, deploy `App-pr-<n>`, smoke test, evidence artifact. Fork PRs never touch AWS.
- `cleanup.yml`: deletes `App-pr-<n>` when the PR closes.
- `deploy.yml`: `main` to `App-dev`, gates first; `App-prod` only when a human starts the workflow by hand ("Run workflow"), in the environment `prod`.
- `sweeper.yml`: nightly, deletes PR stacks older than their `ttlHours` tag.
- `teardown.yml`: by hand only, removes `App-dev` or `App-prod` after the human types the stack name. The `teardown` skill gives the full order.
- `security.yml`: gitleaks and `npm audit`.

## 2. Wire GitHub (the human runs these; generate them as `scripts/setup-github.sh`)

1. Repository variables from `docs/ENVELOPE.md`: `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_ROLE_PR`, `AWS_ROLE_DEV`, `ALERT_EMAIL`.
2. Environment `prod` and its variable `AWS_ROLE_PROD`; a required reviewer on it where the plan allows.
3. Branch protection on `main`: PR required, status checks `gates` and `preview` required, CODEOWNERS review required.
4. Secret scanning push protection on (public repos: default; private repos need GitHub Secret Protection). Turn on delegated bypass if available, so "bypass" is not one click.

A private repository on GitHub Free gets none of 2 (reviewer), 3 or 4: the API answers 422 or 403 "Upgrade to GitHub Pro or make this repository public" (`docs/FACT-CHECKS.md`, F22). Say so plainly, then:
- What still holds: prod runs only by hand, and only from `main`: the repository's subject template puts the branch into the OIDC token, and `baa-gha-prod` trusts `environment:prod:ref:refs/heads/main` only (envelope step 5). The deploy jobs run the gates again before they deploy, and the AWS roles limit what any deploy can do.
- What does not: CODEOWNERS review is advice, and a red PR can be merged; the dev deploy then stops at the gates.
- The choice is the learner's: a public repository (all three are free there; the account ID shows up in public logs) or GitHub Pro.

## 3. Prove it

Open a tiny PR (for example a text change in `site/index.html`) with a prediction. Expect: gates green, drills green, a diff comment, a deployed `App-pr-<n>` with working URLs in the job log, a smoke test pass. Close the PR and watch `cleanup.yml` delete the stack.

If OIDC fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity", compare the token's `sub` (shown in CloudTrail `AssumeRoleWithWebIdentity`) with the trust policy. New repos use the immutable format `repo:owner@id/repo@id:...`; redeploy the envelope with `githubOwnerId` and `githubRepoId`.

## Done when

One PR went through the whole path, the stack was created and deleted by CI, and `docs/ENVELOPE.md` records the run URL as evidence.

---
name: pipeline
description: Connects the learner's GitHub repository to AWS for a Build Anything on AWS project, repo variables, the prod environment with required reviewers, branch protection and CODEOWNERS, and proves it with a first pull request that deploys a throwaway stack.
---

# Pipeline

The workflows ship with the template (`.github/workflows/`). This step wires GitHub to the envelope and proves the path end to end.

## 1. What the workflows do

Explain each in one line before setting anything:

- `pr.yml`: gates from the base branch (a PR cannot weaken the gates that judge it), drills, `cdk diff` as a PR comment next to the learner's prediction, deploy `App-pr-<n>`, smoke test, evidence artifact. Fork PRs never touch AWS.
- `cleanup.yml`: deletes `App-pr-<n>` when the PR closes.
- `deploy.yml`: `main` to `App-dev`; `App-prod` only through the environment `prod` with a human approval.
- `sweeper.yml`: nightly, deletes PR stacks older than their `ttlHours` tag.
- `security.yml`: gitleaks and `npm audit`.

## 2. Wire GitHub (the human runs these; generate them as `scripts/setup-github.sh`)

1. Repository variables from `docs/ENVELOPE.md`: `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_ROLE_PR`, `AWS_ROLE_DEV`, `ALERT_EMAIL`.
2. Environment `prod` with a required reviewer, and its variable `AWS_ROLE_PROD`.
3. Branch protection on `main`: PR required, status checks `gates` and `preview` required, CODEOWNERS review required.
4. Secret scanning push protection on (public repos: default; private repos need GitHub Secret Protection). Turn on delegated bypass if available, so "bypass" is not one click.

## 3. Prove it

Open a tiny PR (for example a text change in `site/index.html`) with a prediction. Expect: gates green, drills green, a diff comment, a deployed `App-pr-<n>` with working URLs in the job log, a smoke test pass. Close the PR and watch `cleanup.yml` delete the stack.

If OIDC fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity", compare the token's `sub` (shown in CloudTrail `AssumeRoleWithWebIdentity`) with the trust policy. New repos use the immutable format `repo:owner@id/repo@id:...`; redeploy the envelope with `githubOwnerId` and `githubRepoId`.

## Done when

One PR went through the whole path, the stack was created and deleted by CI, and `docs/ENVELOPE.md` records the run URL as evidence.

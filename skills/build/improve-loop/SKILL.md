---
name: improve-loop
description: Works through docs/STORIES.md one story per pull request for a Build Anything on AWS project, predict, code, run the gates, explain failures, fix up to three rounds, open the PR and mark the story done only on CI evidence.
---

# Improve loop

One pass takes one story from `todo` to `done`:

```
pick -> predict -> code -> npm run gates -> (red: explain-fail, fix, max 3 rounds) -> commit
     -> PR -> CI: gates from main, drills, cdk diff, App-pr-<n>, smoke -> evidence -> done
```

## 1. Pick

Open `docs/STORIES.md`. Take the first `todo` story of the current milestone whose dependencies are `done`. Set it to `doing`. Create a branch `story/s-003-short-name`.

## 2. Predict

Before any code, the learner predicts (level 1 and 2; at level 0 you predict aloud and the learner checks you later):

- which resources this story adds, changes or replaces,
- whether IAM gets wider,
- what it could cost per month.

The prediction goes into the PR description under `## Prediction`. CI posts the real `cdk diff` next to it. The gap between the two is the lesson.

## 3. Code

Load the Agent Toolkit skill for the service before writing code (`aws-cdk`, `aws-serverless`, `aws-iam`, `aws-storage`, `aws-observability`); do not answer from memory when a skill exists. Follow the managed-service-first ladder from `blueprint`. Keep constructs small: one file per concern in `lib/`.

Who writes the code depends on `docs/LEARNER.md` for this story's topic:

| Level | Production code |
|---|---|
| 0 | You write it, then add an Insight block: what changed and which AWS concept it uses. End with one or two questions about it. |
| 1 | You write the frame and leave `TODO(human)` at the decision that matters (a policy, a removal policy, a route). Wait. |
| 2 | The learner writes it. You review only. |

## 4. Gates

Run `npm run gates`. Green means every native gate passed; say which ones ran. Red means: call the Skill tool with `explain-fail` before you touch the code. Never edit `gates/`, the Guard rules, the cdk-nag packs or a test to make a red gate green. An acknowledgement needs a reason a reviewer would accept and goes next to the code it excuses.

At most three fix rounds per story. Still red after three: set the story to `blocked` with the gate, the error and what you tried, and move on.

## 5. Commit and PR

One story per commit. Message: the story title. Push the branch and open the PR with the template (story, prediction, checks). The learner merges; at level 0 you may suggest it after CI is green.

## 6. Done

A story is `done` only when the PR's CI run shows: gates green, drills green, `App-pr-<n>` deployed, smoke test passed, evidence uploaded. Paste the run URL into the story. No CI evidence, no `done`.

Write `// shortcut: <limit>, upgrade when <condition>` where you knowingly took a shortcut.

## Running it unattended

Only when the brief allows it, and only with this contract written in the session first:

- Objective: the stories of milestone Mx.
- Constraints: sandbox only, never prod; no edits to `gates/`, `.github/`, `envelope/`, `hooks/`; no new resource types.
- Validation command: `npm run gates && npm run drills`.
- Stop condition: every story `done` with CI evidence or `blocked` with a reason, or the budget alarm fires, or three stories in a row are blocked.

Make sure the tree is committed before you start. Each story is its own PR, so the learner can review and revert in the morning.

## Done when

Every story of the milestone is `done` with a CI run URL or `blocked` with a reason, and the learner got a report: stories done, stories blocked and why, what to try by hand, the next story.

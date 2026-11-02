---
name: baa
description: Build Anything on AWS. Start here to find the next step for an AWS project built with a coding agent, from first brief to a deployed, checked and understood system.
disable-model-invocation: true
---

# Build Anything on AWS

Find where the user is on the path below, then call the Skill tool with the skill for that step. One skill per call. When it finishes, tell the user which step comes next.

```
preflight -> envelope -> aws-brief -> blueprint -> user-stories -> scaffold -> pipeline
          -> improve-loop (one story per PR: predict, code, gates, explain-fail, deploy pr-N)
          -> wa-checkpoint + debrief at the end of each milestone -> next milestone
```

Two rules hold on every step:

1. The agent never deploys. Deploys and deletes go through a pull request and GitHub Actions. The local agent has read-only AWS access (`baa-agent-readonly`), and the deny hook blocks `cdk deploy`.
2. Nothing is done without evidence. "Deployed" means a green CI run with a smoke test; "safe" means green gates; "learned" means a check with a real answer. Say which evidence you have and which you do not.

## Where is the user?

Read the project before you route. State lives in files, not in your memory of earlier sessions.

| The project has | Next skill |
|---|---|
| No `.baa/preflight.json` | `preflight` |
| Preflight done, but `docs/ENVELOPE.md` is missing or says `status: pending` | `envelope` |
| No `docs/BRIEF.md`, or the brief has open questions | `aws-brief` |
| A brief, no `## Blueprint` section in it | `blueprint` |
| A blueprint, no `docs/STORIES.md` | `user-stories` |
| Stories, but no CDK app (`cdk.json` missing) | `scaffold` |
| An app, but `.github/workflows/pr.yml` missing or repo variables not set | `pipeline` |
| Stories in `todo` or `doing` | `improve-loop` |
| Every story of the milestone `done` or `blocked`, no `docs/review/<milestone>.md` | `wa-checkpoint`, then `debrief` |
| A red gate right now | `explain-fail` |
| The user asks about their level or wants less or more help | `level` |
| The user wants the app, prod data or the whole setup removed from the account | `teardown` |

## When to send the user elsewhere

- They only want an existing app online and do not want to learn AWS: say so plainly and point to the Agent Toolkit skill `launch-with-aws`. This repo is the slower path that teaches.
- They need something no blueprint in `specs/` covers: stop, say which part is outside the catalog, and offer the closest blueprint. Do not improvise infrastructure outside the catalog for a learner at level 0.

## Language

Talk to the learner in their language. Keep AWS service names, file names and commands in English.

## Done when

You named the step, called its skill, and told the user which skill comes after it.

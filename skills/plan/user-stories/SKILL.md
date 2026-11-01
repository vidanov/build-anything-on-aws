---
name: user-stories
description: Turns the brief and the chosen blueprint into docs/STORIES.md, a milestone backlog where every acceptance line names how it is checked, synth, policy, unit, deploy, cost or manual.
---

# User stories

Stories are the unit of work, of commits and of learning. One story is one pull request.

## Format

Copy the stories of the chosen spec into `docs/STORIES.md`, then adapt them to the brief. Each story:

```
### S-003 POST /visits counts visits
status: todo            # todo | doing | done | blocked
depends: S-002
topic: data             # iam | edge | compute-api | data | cost | observability | cicd
As a visitor I see how many visits the page had.
- [unit] handler adds 1 and returns the new count
- [policy] table is on-demand with point-in-time recovery
- [deploy] two POSTs to the deployed API count up
```

Check tags, strongest first:

| Tag | Checked by | Oracle class |
|---|---|---|
| `[unit]` | jest or node test on code or the synthesized template | native |
| `[synth]` | `cdk synth` with cdk-nag, cfn-lint | native |
| `[policy]` | cfn-guard rules in `gates/guard/` | native |
| `[deploy]` | smoke test against the real `App-pr-<n>` stack in CI | manufactured |
| `[cost]` | resource allowlist, no orphaned resources after cleanup | native |
| `[manual]` | a human looks and signs in the PR | human |

Prefer the strongest tag that can check the line. A story whose lines are all `[manual]` is not ready.

## Rules

- First milestone: 5 to 10 stories. It must end with something deployed and smoke-tested.
- The `topic` feeds the learner model in `docs/LEARNER.md`.
- Order by dependency; the first story builds the skeleton.

## Done when

`docs/STORIES.md` has a milestone M1, every story has a topic and at least one non-manual check, and the learner agreed with the order.

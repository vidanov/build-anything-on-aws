---
name: level
description: Shows or changes the learner level per topic in a Build Anything on AWS project and explains what the agent will and will not do at each level; promotion needs checks with real answers, not time.
disable-model-invocation: true
---

# Level

Levels decide who writes the fix. They are tracked per topic (`iam`, `edge`, `compute-api`, `data`, `cost`, `observability`, `cicd`) in `docs/LEARNER.md`, because someone can be at level 2 for S3 and at level 0 for IAM.

| Level | Who writes the fix | What the agent does | What the learner must do | Output style |
|---|---|---|---|---|
| 0 | the agent | fixes, explains, writes the card | answer one or two questions after each fix | `baa-l0` |
| 1 | the learner, in `TODO(human)` | proposes, leaves `TODO(human)`, waits, gives hints | hypothesis before the fix, explain-back before the push | `baa-l1` |
| 2 | the learner | reviews only, no production code | fix and predict the `cdk diff` | `baa-l2` |

## Show

Print the topic table from `docs/LEARNER.md`: level, checks passed without hints, checks with hints, last seen. Show the learner's prediction accuracy on `cdk diff` next to their own confidence rating from the last debrief.

## Promote and demote

A topic moves up when the last 3 checks with a real answer in that topic passed without hints. Checks with a real answer: a prediction compared with the real `cdk diff`, a gate that went green after the learner's own fix, a planted defect the learner caught in review, the milestone transfer task. An explain-back graded by the model alone does not count.

A topic moves down after 2 failed checks in a row. Say it plainly and without drama: more help for now.

The learner may ask for a lower level at any time. A higher level than the evidence supports needs a sentence from the learner on why, recorded in `docs/LEARNER.md`.

## Switch the style

In Claude Code set `outputStyle` in `.claude/settings.local.json` to the style of the learner's current level for the topic at hand. Styles shape the voice; the hooks and the CI check are what enforce explain-back.

## Done when

The learner saw their table and, if something changed, `docs/LEARNER.md` records the change with the evidence behind it.

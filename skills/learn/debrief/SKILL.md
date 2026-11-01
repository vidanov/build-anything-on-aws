---
name: debrief
description: Closes a Build Anything on AWS milestone with a learning debrief, questions built from what actually happened in FIXLOG, recall of older LEARNED cards, a confidence check, a small transfer task and the shortcut ledger.
---

# Debrief

Run after `wa-checkpoint`, at the end of every milestone. It takes about 15 minutes and measures the learner, not the agent.

## 1. Confidence first

Ask the learner to rate from 1 to 5 how well they could explain each topic touched in this milestone. Record it before any question.

## 2. Questions from this milestone

Five questions, generated from `docs/FIXLOG.md` and the `cdk diff` predictions of this milestone, not from a textbook. Prefer questions with one right answer: "what would `cdk diff` show if...", "which gate fails if...", "which line grants...". Show the score next to the confidence rating; the gap is useful information, not a grade.

## 3. Older cards

Mix in two or three cards from `docs/LEARNED.md` from earlier milestones (spaced recall). A card answered wrong comes back next time.

## 4. Transfer task

One small change the learner makes alone, with the agent in review mode only. Examples: add a third alarm, change log retention for one log group, add a route with an authorizer stub. The gates judge it. This is the strongest evidence for a level change.

At level 1, about every third PR may contain one planted defect taken from the learner's own FIXLOG history. Tell the learner up front that this can happen. Record whether they caught it in review.

## 5. Shortcuts

Collect every `// shortcut:` comment into `docs/SHORTCUTS.md`: where, the limit, when to upgrade. Ask whether any condition for an upgrade is already true.

## 6. Record

Update `docs/LEARNER.md` per topic and call the Skill tool with `level` if a promotion or demotion is due.

## Done when

Confidence and score are both recorded per topic, the transfer task was judged by the gates, and `docs/SHORTCUTS.md` is current.

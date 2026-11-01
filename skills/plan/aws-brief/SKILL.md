---
name: aws-brief
description: Interviews the learner about what they want to build on AWS until every decision that matters for cost, safety and data is settled, adapting the questions to the learner level, and writes docs/BRIEF.md, docs/GLOSSARY.md and ADRs.
disable-model-invocation: true
---

# AWS brief

A grilling session in the style of Matt Pocock's `grilling` skill, adapted for someone who does not know AWS words yet. Beginners answer "agreed" to everything when questions arrive in bulk, so the shape of the interview follows the learner level in `docs/LEARNER.md`.

## How to ask

Walk the decision tree. Ask only questions whose prerequisites are answered. Facts you can look up (what the repo already has, what a service costs, what the Agent Toolkit skill says) you find yourself; decisions stay with the human.

| Level | Shape of each question |
|---|---|
| 0 | One question at a time. Options A to D, one marked recommended, and one line "Why this matters on AWS:" naming the money or safety consequence. |
| 1 | One round of all open questions, each with a recommended answer. Then the learner restates one decision in their own words. |
| 2 | Open questions, no recommendations, unless the learner asks. |

## What must be decided

1. **What and for whom.** One sentence: who uses it and what they get.
2. **Data.** Does it store anything about people? Which categories? Where (region), how long, how is it deleted on request, who processes it? No personal data in logs. A route that touches personal data needs auth. If the answer is "yes" at level 0, only blueprints whose spec says `personal-data: ok` remain.
3. **Criticality.** What happens if it is down for an hour? For a day? (Sets RTO and RPO in plain words.)
4. **Money.** Monthly ceiling the learner accepts. Must be at or below the envelope budget.
5. **Access.** Public, sign-in for some, private. Each public route needs an ADR.
6. **Region.** Comes from `.baa/preflight.json`; explain why it is fixed in profile A.
7. **Agent autonomy.** May the improve-loop run unattended? Up to which stage (never prod)?

Questions that words cannot settle ("is CloudFront fast enough for me?") become a prototype story in the sandbox instead of an answer.

## Optional: the simulated customer

At level 0 and 1 the learner may ask you to play a customer who wants the app. Stay in role, answer only what a customer would know, and let the learner extract the requirements. Step out of role when the learner says "stop".

## Writing it down

- `docs/BRIEF.md` from the template: every decision with the answer and who decided. Open items under `## Open`.
- `docs/GLOSSARY.md`: each AWS term the learner met, one plain sentence, in their language.
- An ADR in `docs/adr/` only when a decision is hard to reverse, surprising without context, and a real trade-off. Use `docs/adr/TEMPLATE.md` (Decision, Reasons, Verification, Firing condition, Retirement).

## Done when

`docs/BRIEF.md` has no open item that blocks the first milestone, the learner confirmed it, and the data questions have explicit answers (also "none").

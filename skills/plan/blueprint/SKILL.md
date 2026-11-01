---
name: blueprint
description: Picks the blueprint from specs/ that fits the brief, applies the managed-service-first ladder, draws the target architecture and states the cost assumptions, and records the choice in the Blueprint section of docs/BRIEF.md.
---

# Blueprint

The learner does not design an architecture from scratch. They choose a tested blueprint from `specs/` and understand why it fits. The catalog is the product: every blueprint has gates, drills and stories that are known to work.

## 1. Match the brief to the catalog

Read `specs/README.md` and each spec's `Fits when` and `Does not fit when`. Present at most three candidates with one line each on fit, monthly cost driver and what the learner will learn. Recommend one.

If nothing fits, say which requirement is outside the catalog. Offer the closest blueprint with that requirement moved to a later milestone. Do not invent infrastructure for a level 0 learner.

## 2. Managed service before code

For every part of the brief, climb this ladder and stop at the first rung that works. This is Ponytail's reuse ladder rewritten for AWS:

1. Does it need to exist at all for this milestone?
2. Does a managed service or a built-in feature do it? (S3 and CloudFront for a site, Cognito for sign-in, S3 lifecycle rules for cleanup, EventBridge Scheduler for timers, Step Functions for multi-step work)
3. Does a CDK L2 or L3 construct do it?
4. Then, and only then, write code.

Lazy never means unsafe. These are never cut: encryption, least-privilege IAM, logs with retention, alarms, the budget, backups for data, removal policy by stage. The gates enforce them.

When a shortcut is taken on purpose, mark it in code: `// shortcut: <limit>, upgrade when <condition>`. Example: `// shortcut: single region, upgrade when the brief needs 99.9% availability`. The debrief collects them into `docs/SHORTCUTS.md`.

## 3. Draw it

A diagram before building. If the `baa-diagram` skill (vidanov/aws-architecture-diagram-skill) is installed, use it; otherwise a Mermaid flowchart in `docs/BRIEF.md` is enough. The diagram is a plan, not proof: after each milestone it is compared with `cdk.out`.

## 4. Cost, as advice

Use the Agent Toolkit skill `aws-billing-and-cost-management` for the estimate; never compute prices in your head. Write the drivers (requests, storage, data out) and the assumption behind each. The blocking cost gate is the resource allowlist in `gates/guard/cost-allowlist.guard`, not this estimate.

## 5. Record

Add `## Blueprint` to `docs/BRIEF.md`: spec name and version, why it fits, what was moved to later milestones, diagram, cost drivers.

## Done when

The brief names one blueprint, the learner can say why it fits in one sentence, and every requirement is either covered or explicitly moved to a later milestone.

---
name: explain-fail
description: Turns a red gate in a Build Anything on AWS project into a lesson, reproduce the failure, get the learner's hypothesis first at level 1 and 2, give hints instead of answers, fix, and record the FIXLOG entry and the LEARNED card.
---

# Explain a failed gate

A red gate is the best teaching moment in this repo. Research on learning with AI assistants is clear on one point: when the AI debugs for the learner, the learner learns least. So the order below matters more than speed.

## 1. Reproduce (Prove-It)

Run the failing gate again and show the exact finding: rule ID, construct path or resource, message. If it does not fail again, say so and stop: a gate that fails only sometimes is a bug to report, not a lesson.

## 2. Name the question, not the answer

Say which Well-Architected question the gate protects (the Guard rules and cdk-nag messages name it) and look up the card in `references/cards/` if one exists. Do not show the fix yet.

## 3. Hypothesis first (level 1 and 2)

Ask the learner: which resource, which pillar, why it is a problem. Wait for an answer. Then:

- right: confirm and let them fix (level 2) or fill the `TODO(human)` (level 1);
- partly right: one hint, then ask again;
- stuck after two hints: show the fix and explain it, and count it as "hinted".

At level 0, explain the cause and the fix yourself, then ask one question about it.

## 4. Fix

Fix the code, never the gate. Re-run `npm run gates`. Three rounds at most, then the story goes `blocked` (see `improve-loop`).

Security warnings and irreversible actions are always explained in full sentences, whatever the output style.

## 5. Record

Append to `docs/FIXLOG.md`:

```
## 2026-11-03 S-003 guard:secure-defaults dynamodb_pitr
Symptom: guard rule dynamodb_pitr failed on DataTable
Cause: table created without point-in-time recovery
Fix: pointInTimeRecoverySpecification in lib/data.ts
WA: REL09 back up data
Prediction: <what the learner expected, or none>
Hypothesis: <learner's words> (correct | partly | wrong)
Hints: 1
Explain-back: TODO
Rule: every table that holds data gets point-in-time recovery
```

`Explain-back` is filled by the learner in their own words before the push (the hook and CI check it at level 1 and 2).

Add or update a card in `docs/LEARNED.md`: topic, one-line rule, why, the fix pattern, date seen. Update the topic row in `docs/LEARNER.md`: one more check, with or without hints.

## Done when

The gate is green, the FIXLOG entry is complete except the learner's explain-back, the card exists, and the learner was asked before they were told (level 1 and 2).

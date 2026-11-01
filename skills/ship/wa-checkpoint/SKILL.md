---
name: wa-checkpoint
description: Runs the Well-Architected checkpoint at the end of a Build Anything on AWS milestone, an advisory review with the Agent Toolkit skill, findings turned into stories or new gates with drills, and a human-signed review file.
---

# Well-Architected checkpoint

At the end of each milestone, look at the whole system against the Well-Architected Framework. This review is advice from a model (an internalized oracle in VBA terms). It never blocks a merge by itself; what it finds becomes either a story or a new deterministic gate.

## 1. Review

Load the Agent Toolkit skill `aws-well-architected-review` and run it on this repo: `cdk.out`, `lib/`, `docs/BRIEF.md`. For a Bedrock or agent blueprint, include the Agentic AI Lens (AGENTSEC, AGENTREL, AGENTOPS, AGENTCOST). Never invent best-practice IDs; if a question cannot be answered from the repo, mark it "Cannot determine" and say who can answer it.

## 2. Sort the findings

| Finding | Becomes |
|---|---|
| Checkable in the synthesized template (encryption, public access, retention, auth on a route) | a new rule in `gates/guard/` plus a drill in `gates/drills/run-drills.mjs` that proves it can fail. A gate without a drill is not added. |
| Needs code or design work | a story in the next milestone |
| A conscious trade-off | an ADR, or an acknowledgement with a reason next to the code |
| A question for a human (RTO, data class, threat model) | an open item in `docs/BRIEF.md` |

Changes to `gates/` go in their own PR and need the CODEOWNERS review.

## 3. Diagram drift

Compare the resource types in `cdk.out/*.template.json` with the diagram in `docs/BRIEF.md`. Anything built but not drawn, or drawn but not built, is a finding.

## 4. Sign

Write `docs/review/<milestone>.md`: findings, where each went, what was not checked. A human signs it with their name and date in the PR that adds it.

## Done when

Every finding has a destination, each new gate has a drill that goes red, and the review file is signed by a human.

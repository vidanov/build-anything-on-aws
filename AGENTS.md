# Agent guidance for this repository

This repo is a plugin of agent skills plus a project template. Contributions from people and
agents are welcome; the checks below decide, not the author of the change.

## Commands

| Task | Command |
|---|---|
| Validate skills (spec, Done when, collisions, manifest) | `node scripts/validate-skills.mjs` |
| Hook tests | `node --test hooks/test/deny-aws.test.mjs` |
| Template gates | `cd template && npm ci && npm run gates` |
| Template gates, prod shape | `cd template && BAA_STAGE=prod npm run gates` |
| Drills (every gate must fail on its planted violation) | `cd template && npm run drills` |
| Plugin manifest | `claude plugin validate .` |

## Rules

- A new gate needs a drill in `template/gates/drills/run-drills.mjs` that makes it fail.
- `hooks/deny-patterns.txt` only grows; each new pattern needs a test in `hooks/test/`.
- Skills follow the Agent Skills spec: `name` equals the folder, `description` says when to
  use it, body under 500 lines, a `## Done when` section. User-invoked skills set
  `disable-model-invocation: true` and ship `agents/openai.yaml`.
- AWS service knowledge belongs to the Agent Toolkit for AWS. Skills here reference its
  skills by name and own only the path, the gates, the learning layer and the envelope.
- A fact the design relies on goes into `docs/FACT-CHECKS.md` with its status.

## Completion evidence

Report every command above that you ran, with its exit code, the files you changed, and what
you could not verify (anything that needs a real AWS account).

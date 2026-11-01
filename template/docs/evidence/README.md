# Evidence

Evidence is written by GitHub Actions, never by the agent (an oracle the agent can edit is not
independent). Each PR and deploy run uploads `evidence-*.json` as a run artifact.

States: configured (file exists), executed (gate ran), demonstrated (deployed and the smoke
test passed in a real account), unknown. A story is done only with a demonstrated record.

# Drills

A gate that has never fired cannot be told apart from a gate that is miswired. Each drill
plants one violation and expects its gate to go red. `npm run drills` runs them all; CI runs
them on every PR, from the base branch's copy of `gates/`.

| ID | Drill | Gate | Oracle |
|---|---|---|---|
| D-01 | bucket-public-access-off | guard secure-defaults | native |
| D-02 | bucket-without-encryption | guard secure-defaults | native |
| D-03 | bucket-policy-allows-http | guard secure-defaults | native |
| D-04 | table-without-pitr | guard secure-defaults | native |
| D-05 | logs-kept-forever | guard secure-defaults | native |
| D-06 | open-function-url | guard secure-defaults | native |
| D-07 | nat-gateway | guard cost-allowlist | native |
| D-08 | provisioned-table | guard cost-allowlist | native |
| D-09 | unlisted-public-route | guard public-routes | native |
| D-10 | pr-stack-retains-data | guard stage-removal | native |
| D-11 | prod-deletes-data | guard stage-removal | native |
| D-12 | wildcard-action | cdk-nag AwsSolutions-IAM5 | native |
| D-13 | bucket-without-tls | cdk-nag AwsSolutions-S10 | native |
| D-14 | envelope: roles without boundary, wildcard OIDC subject, admin execution policy | jest test/envelope.test.ts | native |
| D-15 | deny hook: 26 dangerous commands blocked, safe ones allowed | plugin hooks/test | native |

Oracle classes (VBA): native gates block; manufactured (smoke test) blocks once its drill
proves it can fail; proxy (cost estimates, Checkov) advises; internalized (LLM reviews) never
blocks and goes to a human.

---
id: ADR-0001
status: proposed
scope:
  - lib/api.ts
  - gates/guard/public-routes.guard
---

# GET /health and POST /visits are public

## Decision

The two routes of milestone 1 have no authorizer. Every other route must have one.

## Reasons

- They carry no personal data: a health flag and one global counter.
- The page must call them from any browser without sign-in.
- Abuse is limited by stage throttling (10 requests per second, burst 20) and costs at most
  the on-demand price of those requests.

## Verification

`cfn-guard validate -r gates/guard/public-routes.guard -d cdk.out/App-pr-0.template.json`
passes, and the jest test "exactly the two public routes exist" passes.

## Firing condition

Drill D-09 (`unlisted-public-route`) adds `DELETE /visits` without auth; the Guard rule fails.

## Retirement

Revisit when the API stores personal data or gains a route that changes data other than the
counter (milestone 2, Cognito JWT authorizer).

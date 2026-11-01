# Card: public-route

Rule: an API route without an authorizer must be on the public list and have an ADR.
Why: every anonymous route is an open door. Listing them makes each one a decision instead of an accident.
Gate: guard public-routes, cdk-nag AwsSolutions-APIG4 (acknowledged only with the ADR reason).
Fix: add a JWT authorizer (Cognito, milestone 2), or add the route to gates/guard/public-routes.guard in a reviewed PR with docs/adr/NNNN.
WA: SEC02 identities.
Check yourself: what stops a stranger from calling POST /visits a million times? (Hint: lib/api.ts, throttle.)

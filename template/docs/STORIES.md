# Stories

Milestone M1: blueprint 01-static-site-api. Status: todo | doing | done | blocked.
A story is done only with a green CI run; paste its URL under the story.

### S-001 The page opens over CloudFront; the bucket is not public
status: todo
topic: edge
- [unit] Origin Access Control and Block Public Access in the template
- [policy] guard secure-defaults
- [deploy] 200 over HTTPS, HTTP redirects to HTTPS

### S-002 GET /health answers 200
status: todo
depends: S-001
topic: compute-api
- [unit] handler test
- [deploy] smoke test

### S-003 POST /visits counts visits in DynamoDB
status: todo
depends: S-002
topic: data
- [unit] handler adds 1
- [policy] on-demand table with point-in-time recovery
- [deploy] two POSTs count up

### S-004 Each public route has an ADR and is throttled
status: todo
depends: S-003
topic: iam
- [policy] guard public-routes
- [unit] stage throttling 10 rps
- [manual] docs/adr/0001-public-routes.md accepted in the PR

### S-005 Budget alerts arrive by email
status: todo
topic: cost
- [unit] envelope test: monthly budget with forecast alert
- [manual] AWS Budgets subscription confirmed

### S-006 Alarms for Lambda errors and API 5xx
status: todo
depends: S-003
topic: observability
- [unit] two alarms on the alert topic
- [deploy] alarms exist in App-pr-<n>

### S-007 The PR shows gates, cdk diff and my prediction side by side
status: todo
topic: cicd
- [policy] pr.yml gates job green
- [manual] one FIXLOG line on where the prediction was wrong

### S-008 App-pr-<n> comes up, passes smoke, and is gone when the PR closes
status: todo
depends: S-007
topic: cicd
- [deploy] smoke test in pr.yml
- [cost] cleanup.yml deleted the stack, nothing left in the account

### S-009 Prod deploys only through the prod environment with a reviewer
status: todo
depends: S-008
topic: cicd
- [deploy] deploy.yml prod job ran after approval
- [manual] reviewer approved in GitHub

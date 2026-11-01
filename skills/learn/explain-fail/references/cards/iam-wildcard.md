# Card: iam-wildcard

Rule: a policy names the actions and the resources it needs. `*` needs a written reason.
Why: a wildcard grants what nobody reviewed, and the agent that wrote it will not remember why.
Gate: cdk-nag AwsSolutions-IAM5, unit test "no IAM statement allows every action", boundary.
Fix: use grants (`table.grantReadWriteData(fn)`) instead of hand-written statements; when a service has no resource-level permissions (X-Ray), acknowledge with that reason next to the code.
WA: SEC03 least privilege.
Check yourself: which line in lib/api.ts gives the function access to the table, and to which table exactly?

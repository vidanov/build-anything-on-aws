# Profile C: team or business unit

For: a team or an enterprise business unit with AWS Organizations.

Use everything from profile B, plus an organization-level layer the project cannot change:
- Separate accounts: sandbox (pr-* and dev stacks) and prod. Deploy the envelope in each.
- SCPs on the OU: region deny with global-service exceptions (pattern of Control Tower
  CT.MULTISERVICE.PV.1), deny NAT gateways and large instances, deny IAM users and access keys,
  deny LeaveOrganization, protect CloudTrail. The statements in `envelope/boundary.ts` are the
  starting point; validate each SCP with
  `aws accessanalyzer validate-policy --policy-type SERVICE_CONTROL_POLICY`.
- Identity Center for people, Budgets actions (apply a deny policy at 100%), Cost Anomaly
  Detection, Security Hub, GuardDuty.
- CloudFormation Guard hook: load `gates/guard/*.guard` as an `AWS::CloudFormation::GuardHook`
  with FailureMode FAIL, so a deploy that skips CI hits the same rules. (Planned in the envelope;
  not built yet.)

In an existing landing zone (Control Tower, LZA), map these onto the controls you already run
instead of adding a second set. The repo's job is the project envelope, not the landing zone.

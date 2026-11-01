# Profile B: classic single account

For: a learner who needs eu-central-1, or who already has a classic account.

Free plan warning: joining or creating AWS Organizations, or setting up Control Tower, moves a
Free plan account to the Paid plan automatically. So in profile B there are no SCPs of your
own. The permissions boundary (`baa-boundary`) does their job for every role CDK creates.
The Free plan ends after 6 months or when the credits run out; then the account closes and is
erased after 90 days unless you upgrade. Keep nothing there you cannot lose.

Steps (a human does these, not the agent):
1. Root user: MFA on, then never use it again. Sign in with `aws login` (or Identity Center).
2. Envelope: `npm run envelope:deploy -- -c profile=B -c region=eu-central-1 -c githubOwner=<you> -c githubRepo=<repo> -c alertEmail=<you>`
   Add `-c githubOwnerId=<id> -c githubRepoId=<id>` for repos created or renamed after
   2026-07-15 (immutable OIDC subjects): `gh api repos/<owner>/<repo> --jq '.owner.id, .id'`.
3. Confirm the budget emails from AWS Budgets when they arrive.
4. Bootstrap: run the `BootstrapCommand` output. It replaces AdministratorAccess with
   `baa-cfn-exec` and puts `baa-boundary` on every role CDK creates.
5. Agent profile in `~/.aws/config`:
   ```
   [profile baa-agent]
   role_arn = <AgentRoleArn output>
   source_profile = <your profile>
   region = eu-central-1
   ```
   The coding agent and the AWS MCP proxy use `AWS_PROFILE=baa-agent`. It can read, not write.

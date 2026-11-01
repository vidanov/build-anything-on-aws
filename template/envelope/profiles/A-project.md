# Profile A: project in the new AWS sign-up (since 16 Sep 2026)

For: one learner who signed up with Google, GitHub, Apple or Amazon and works in a "project".

What AWS already gives you: an organization managed by AWS, AWS-written SCPs and RCPs,
no root user, a spend limit on the Paid plan (from 20 USD, pauses the project when reached).

What you cannot choose: the region. It follows your contact country (Germany: eu-north-1)
and cannot be changed. Pass it everywhere: `-c region=eu-north-1` and `-c baa:region=eu-north-1`.

What is not available: your own SCPs, GuardDuty, Security Hub, Access Analyzer (except
policy validation), cross-region features, WAF on CloudFront, a certificate in us-east-1.
Blueprint 01 runs on `*.cloudfront.net` for this reason.

Steps (a human does these, not the agent):
1. `aws login`, then check: `aws sts get-caller-identity`.
2. Envelope: `npm run envelope:deploy -- -c profile=A -c region=<project region> -c githubOwner=<you> -c githubRepo=<repo> -c alertEmail=<you>`
   The trail is skipped: the project is already audited by AWS.
3. Bootstrap: copy the `BootstrapCommand` output and run it.
4. Put the role ARNs into GitHub: see the `envelope` skill (it generates a wizard script).

Not yet verified for profile A (docs/FACT-CHECKS.md): whether the AWS-managed SCP
(`RegionFloor`) allows `iam:CreateOpenIDConnectProvider` and `cdk bootstrap`.
If step 2 or 3 fails with AccessDenied from an SCP, use profile B.

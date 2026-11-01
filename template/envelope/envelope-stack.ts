import { CfnOutput, Duration, LegacyStackSynthesizer, RemovalPolicy, Stack, StackProps, aws_budgets as budgets, aws_cloudtrail as cloudtrail, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { boundaryStatements } from './boundary';
import { cfnExecStatements } from './cfn-exec';

export type EnvelopeProfile = 'A' | 'B' | 'C';

export interface EnvelopeProps extends StackProps {
  /** A: new sign-up project, B: classic single account, C: team or business unit. */
  readonly profile: EnvelopeProfile;
  readonly githubOwner: string;
  readonly githubRepo: string;
  /** Numeric IDs for GitHub immutable subject claims (repos created or renamed after 2026-07-15). */
  readonly githubOwnerId?: string;
  readonly githubRepoId?: string;
  readonly alertEmail: string;
  readonly monthlyBudgetUsd: number;
  /** Regions the boundary allows. Global services stay reachable. */
  readonly allowedRegions: string[];
  /** Own management-events trail (default on). Off when an organization trail already records the account. */
  readonly trail?: boolean;
}

export const BOUNDARY_NAME = 'baa-boundary';
export const CFN_EXEC_POLICY_NAME = 'baa-cfn-exec';
// BAA bootstraps its own toolkit stack instead of the default CDKToolkit (qualifier hnb659fds),
// so an account that other CDK projects already bootstrapped keeps its execution role.
// QUALIFIER must equal @aws-cdk/core:bootstrapQualifier in cdk.json (test/envelope.test.ts).
export const QUALIFIER = 'baa';
export const TOOLKIT_STACK_NAME = 'BaaToolkit';

/**
 * The envelope deploys before `cdk bootstrap`, with the human's CLI credentials. The CLI
 * passes the template inline (CloudFormation takes up to 51,200 bytes in the request), so no
 * assets bucket and no bootstrap role are needed. The alternatives do not work here:
 * CliCredentialsStackSynthesizer uploads the template to cdk-<qualifier>-assets-*, and
 * BootstraplessSynthesizer still assumes cdk-hnb659fds-deploy-role; neither exists in a fresh
 * account. test/envelope.test.ts checks this and the size limit.
 */
export const envelopeSynthesizer = (): LegacyStackSynthesizer => new LegacyStackSynthesizer();
export const INLINE_TEMPLATE_LIMIT = 51_200;

/**
 * The account envelope. A human deploys it once with admin rights; afterwards nothing in
 * the project needs admin again. It holds:
 *   - baa-boundary: the ceiling for every role CDK creates (stands in for SCPs in profiles A and B)
 *   - baa-cfn-exec: what CloudFormation may do on behalf of the app (replaces AdministratorAccess)
 *   - GitHub OIDC provider and three roles: pr, dev, prod (no long-lived keys anywhere)
 *   - baa-agent-readonly: what the local coding agent may use
 *   - a monthly budget with email alerts, and one management-events CloudTrail trail
 * It has no assets and deploys before `cdk bootstrap` (see envelopeSynthesizer).
 */
export class EnvelopeStack extends Stack {
  constructor(scope: Construct, id: string, props: EnvelopeProps) {
    super(scope, id, props);
    const account = Stack.of(this).account;
    const region = Stack.of(this).region;

    // 1. Permissions boundary. Allow everything, then cut out what no role in this account may do.
    const boundary = new iam.ManagedPolicy(this, 'Boundary', {
      managedPolicyName: BOUNDARY_NAME,
      description: 'Ceiling for every role in a Build Anything on AWS account',
      statements: boundaryStatements({ account, allowedRegions: props.allowedRegions, boundaryName: BOUNDARY_NAME }),
    });

    // 2. What CloudFormation may do when CDK deploys the app: the blueprint's services only.
    const cfnExec = new iam.ManagedPolicy(this, 'CfnExec', {
      managedPolicyName: CFN_EXEC_POLICY_NAME,
      description: 'CloudFormation execution policy for cdk bootstrap (instead of AdministratorAccess)',
      statements: cfnExecStatements({ account, boundaryName: BOUNDARY_NAME }),
    });

    // 3. GitHub OIDC: GitHub Actions gets short-lived credentials, scoped to one repository.
    const provider = new iam.OidcProviderNative(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const subjects = (suffix: string): string[] => {
      const subs = [`repo:${props.githubOwner}/${props.githubRepo}:${suffix}`];
      if (props.githubOwnerId && props.githubRepoId) {
        subs.push(`repo:${props.githubOwner}@${props.githubOwnerId}/${props.githubRepo}@${props.githubRepoId}:${suffix}`);
      }
      return subs;
    };

    const bootstrapRoles = (kinds: string[]): string[] =>
      kinds.map((k) => `arn:${Stack.of(this).partition}:iam::${account}:role/cdk-${QUALIFIER}-${k}-role-${account}-${region}`);

    const ghaRole = (name: string, description: string, subs: string[], kinds: string[]): iam.Role => {
      const role = new iam.Role(this, name, {
        roleName: `baa-gha-${name.toLowerCase()}`,
        description,
        maxSessionDuration: Duration.hours(1),
        permissionsBoundary: boundary,
        assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
          // Exact subjects only: StringLike without wildcards, never repo:owner/*.
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          'ForAnyValue:StringLike': { 'token.actions.githubusercontent.com:sub': subs },
        }),
      });
      role.addToPolicy(new iam.PolicyStatement({ actions: ['sts:AssumeRole', 'sts:TagSession'], resources: bootstrapRoles(kinds) }));
      role.addToPolicy(new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks', 'cloudformation:ListStacks', 'cloudformation:DescribeStackEvents'],
        resources: ['*'],
      }));
      iam.PermissionsBoundary.of(role).apply(boundary);
      return role;
    };

    // PR workflow: diff, deploy and destroy throwaway App-pr-<n> stacks. Fork PRs get no OIDC token.
    const pr = ghaRole('Pr', 'GitHub Actions on pull requests: cdk diff and App-pr-<n> stacks', subjects('pull_request'), ['lookup', 'deploy', 'file-publishing', 'image-publishing']);
    // main branch: App-dev.
    const dev = ghaRole('Dev', 'GitHub Actions on main: App-dev', subjects('ref:refs/heads/main'), ['lookup', 'deploy', 'file-publishing', 'image-publishing']);
    // Only the GitHub environment "prod", which has required reviewers.
    const prod = ghaRole('Prod', 'GitHub Actions in environment prod: App-prod', subjects('environment:prod'), ['lookup', 'deploy', 'file-publishing', 'image-publishing']);

    // 4. The local coding agent reads; it never writes. Data plane reads are denied too.
    const agent = new iam.Role(this, 'AgentReadOnly', {
      roleName: 'baa-agent-readonly',
      description: 'Local coding agent: read-only, no data, no secrets. Writes go through pull requests.',
      assumedBy: new iam.AccountPrincipal(account),
      maxSessionDuration: Duration.hours(4),
      permissionsBoundary: boundary,
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess')],
    });
    agent.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: [
        's3:GetObject*', 'dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:Query', 'dynamodb:Scan',
        'secretsmanager:GetSecretValue', 'ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath',
        'kms:Decrypt', 'lambda:GetFunction', 'cloudformation:GetTemplate',
      ],
      resources: ['*'],
    }));
    agent.node.addMetadata('baa:usage', 'agent');

    // 5. Money: email alerts at 25%, 50%, 100% of the monthly budget, and on the forecast.
    const notify = (threshold: number, type: 'ACTUAL' | 'FORECASTED') => ({
      notification: { comparisonOperator: 'GREATER_THAN', notificationType: type, threshold, thresholdType: 'PERCENTAGE' },
      subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
    });
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetName: 'baa-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [notify(25, 'ACTUAL'), notify(50, 'ACTUAL'), notify(100, 'ACTUAL'), notify(100, 'FORECASTED')],
    });

    // 6. Audit: one trail of management events (the first copy is free). Profile A projects
    //    may already have one from AWS; the trail is skipped there. An account in an
    //    organization with an organization trail passes -c trail=false (a second copy is billed).
    if (props.profile !== 'A' && props.trail !== false) {
      const trailBucket = new s3.Bucket(this, 'TrailBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        lifecycleRules: [{ expiration: Duration.days(365) }],
        removalPolicy: RemovalPolicy.RETAIN,
      });
      new cloudtrail.Trail(this, 'Trail', {
        trailName: 'baa-management-events',
        bucket: trailBucket,
        isMultiRegionTrail: true,
        includeGlobalServiceEvents: true,
        enableFileValidation: true,
      });
    }

    new CfnOutput(this, 'PrRoleArn', { value: pr.roleArn, description: 'gh variable set AWS_ROLE_PR' });
    new CfnOutput(this, 'DevRoleArn', { value: dev.roleArn, description: 'gh variable set AWS_ROLE_DEV' });
    new CfnOutput(this, 'ProdRoleArn', { value: prod.roleArn, description: 'gh variable set AWS_ROLE_PROD --env prod' });
    new CfnOutput(this, 'AgentRoleArn', { value: agent.roleArn, description: 'role_arn for the [profile baa-agent] in ~/.aws/config' });
    new CfnOutput(this, 'BootstrapCommand', {
      value: [
        `npx cdk bootstrap aws://${account}/${region}`,
        `--qualifier ${QUALIFIER} --toolkit-stack-name ${TOOLKIT_STACK_NAME}`,
        `--cloudformation-execution-policies arn:${Stack.of(this).partition}:iam::${account}:policy/${CFN_EXEC_POLICY_NAME}`,
        `--custom-permissions-boundary ${BOUNDARY_NAME}`,
        '--termination-protection',
      ].join(' '),
    });
    void cfnExec;
  }
}

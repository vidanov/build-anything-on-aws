import { aws_iam as iam } from 'aws-cdk-lib';

export interface BoundaryInput {
  readonly account: string;
  readonly allowedRegions: string[];
  readonly boundaryName: string;
}

// Services that live in us-east-1 or have no region. Denying them by region would break
// CloudFront, IAM, Budgets and the like. Modeled on the Control Tower region deny control
// (CT.MULTISERVICE.PV.1), trimmed to what the blueprints use.
const GLOBAL_SERVICES = [
  'a4b:*', 'acm:*', 'aws-portal:*', 'budgets:*', 'ce:*', 'chime:*', 'cloudfront:*', 'cur:*',
  'globalaccelerator:*', 'health:*', 'iam:*', 'importexport:*', 'kms:*', 'organizations:*',
  'route53:*', 'route53domains:*', 's3:GetAccountPublicAccessBlock', 's3:ListAllMyBuckets',
  'shield:*', 'sts:*', 'support:*', 'trustedadvisor:*', 'waf:*', 'waf-regional:*', 'wafv2:*',
  'freetier:*', 'billing:*', 'account:Get*', 'account:List*', 'pricing:*', 'aws-marketplace:*',
];

/**
 * The ceiling for every role in the account. It never grants anything by itself; it limits
 * what any attached policy can grant. In profiles A and B it does the job SCPs would do.
 * Every Deny here has a drill in gates/drills (envelope tests).
 */
export function boundaryStatements(input: BoundaryInput): iam.PolicyStatement[] {
  const boundaryArn = `arn:aws:iam::${input.account}:policy/${input.boundaryName}`;
  return [
    new iam.PolicyStatement({ sid: 'AllowWithinBoundary', actions: ['*'], resources: ['*'] }),

    new iam.PolicyStatement({
      sid: 'DenyOutsideAllowedRegions',
      effect: iam.Effect.DENY,
      notActions: GLOBAL_SERVICES,
      resources: ['*'],
      conditions: { StringNotEquals: { 'aws:RequestedRegion': input.allowedRegions } },
    }),

    // Roles may only be created or changed if they carry this same boundary.
    new iam.PolicyStatement({
      sid: 'RolesMustCarryTheBoundary',
      effect: iam.Effect.DENY,
      actions: ['iam:CreateRole', 'iam:PutRolePermissionsBoundary'],
      resources: ['*'],
      conditions: { StringNotEquals: { 'iam:PermissionsBoundary': boundaryArn } },
    }),
    new iam.PolicyStatement({
      sid: 'BoundaryCannotBeRemovedOrEdited',
      effect: iam.Effect.DENY,
      actions: ['iam:DeleteRolePermissionsBoundary', 'iam:CreatePolicyVersion', 'iam:DeletePolicy', 'iam:DeletePolicyVersion', 'iam:SetDefaultPolicyVersion'],
      resources: [boundaryArn, `arn:aws:iam::${input.account}:role/*`],
    }),

    // No long-lived credentials and no IAM users: people use aws login or Identity Center.
    new iam.PolicyStatement({
      sid: 'NoUsersNoKeys',
      effect: iam.Effect.DENY,
      actions: ['iam:CreateUser', 'iam:CreateAccessKey', 'iam:CreateLoginProfile', 'iam:UpdateLoginProfile'],
      resources: ['*'],
    }),

    // Audit stays on.
    new iam.PolicyStatement({
      sid: 'AuditStaysOn',
      effect: iam.Effect.DENY,
      actions: ['cloudtrail:StopLogging', 'cloudtrail:DeleteTrail', 'cloudtrail:PutEventSelectors', 'config:DeleteConfigurationRecorder', 'config:StopConfigurationRecorder'],
      resources: ['*'],
    }),

    // Expensive surprises a learner never needs: NAT gateways (about 35 USD a month each, idle),
    // large or GPU instances, provisioned model throughput, SageMaker endpoints.
    new iam.PolicyStatement({
      sid: 'NoNatGateways',
      effect: iam.Effect.DENY,
      actions: ['ec2:CreateNatGateway'],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      sid: 'OnlySmallInstances',
      effect: iam.Effect.DENY,
      actions: ['ec2:RunInstances', 'ec2:StartInstances'],
      resources: ['arn:aws:ec2:*:*:instance/*'],
      conditions: { 'ForAnyValue:StringNotLike': { 'ec2:InstanceType': ['t4g.nano', 't4g.micro', 't4g.small', 't3.nano', 't3.micro', 't3.small'] } },
    }),
    new iam.PolicyStatement({
      sid: 'NoProvisionedThroughput',
      effect: iam.Effect.DENY,
      actions: ['bedrock:CreateProvisionedModelThroughput', 'sagemaker:CreateEndpoint', 'sagemaker:CreateEndpointConfig'],
      resources: ['*'],
    }),

    new iam.PolicyStatement({
      sid: 'StayInTheOrganization',
      effect: iam.Effect.DENY,
      actions: ['organizations:LeaveOrganization', 'account:CloseAccount'],
      resources: ['*'],
    }),
  ];
}

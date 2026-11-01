import { aws_iam as iam } from 'aws-cdk-lib';

export interface CfnExecInput {
  readonly account: string;
  readonly boundaryName: string;
}

/**
 * What CloudFormation may do when it deploys the app. Passed to cdk bootstrap with
 * --cloudformation-execution-policies, instead of the default AdministratorAccess.
 * The services match gates/guard/cost-allowlist.guard; a new blueprint extends both
 * in the same reviewed pull request. The permissions boundary still applies on top.
 */
export function cfnExecStatements(input: CfnExecInput): iam.PolicyStatement[] {
  const boundaryArn = `arn:aws:iam::${input.account}:policy/${input.boundaryName}`;
  return [
    new iam.PolicyStatement({
      sid: 'BlueprintServices',
      actions: [
        's3:*', 'cloudfront:*', 'apigateway:*', 'execute-api:*', 'lambda:*', 'dynamodb:*',
        'logs:*', 'cloudwatch:*', 'sns:*', 'xray:*', 'ssm:GetParameter*', 'ssm:PutParameter',
        'ssm:DeleteParameter', 'ssm:AddTagsToResource', 'ssm:RemoveTagsFromResource',
        'cloudformation:*', 'tag:*', 'kms:DescribeKey', 'kms:CreateGrant',
      ],
      resources: ['*'],
    }),
    // IAM only for app roles, and only with the boundary attached.
    new iam.PolicyStatement({
      sid: 'AppRolesWithBoundary',
      actions: ['iam:CreateRole', 'iam:PutRolePermissionsBoundary'],
      resources: [`arn:aws:iam::${input.account}:role/*`],
      conditions: { StringEquals: { 'iam:PermissionsBoundary': boundaryArn } },
    }),
    new iam.PolicyStatement({
      sid: 'ManageAppRoles',
      actions: [
        'iam:GetRole', 'iam:DeleteRole', 'iam:TagRole', 'iam:UntagRole', 'iam:UpdateRole',
        'iam:UpdateAssumeRolePolicy', 'iam:PutRolePolicy', 'iam:DeleteRolePolicy', 'iam:GetRolePolicy',
        'iam:AttachRolePolicy', 'iam:DetachRolePolicy', 'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies',
        'iam:PassRole', 'iam:CreateServiceLinkedRole', 'iam:GetPolicy', 'iam:GetPolicyVersion',
      ],
      resources: [`arn:aws:iam::${input.account}:role/*`, `arn:aws:iam::${input.account}:policy/*`, 'arn:aws:iam::aws:policy/*'],
    }),
  ];
}

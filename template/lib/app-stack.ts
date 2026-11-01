import { CfnElement, CfnOutput, DefaultStackSynthesizer, Stack, StackProps, Tags, Token, Validations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Api } from './api';
import { Data } from './data';
import { Frontend } from './frontend';
import { Ops } from './ops';
import { Settings } from './settings';

export interface AppStackProps extends StackProps {
  readonly settings: Settings;
}

/** Blueprint 01-static-site-api: CloudFront -> S3 (OAC) and HTTP API -> Lambda -> DynamoDB. */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { settings } = props;

    if (settings.kind === 'pr') {
      // The nightly sweeper deletes PR stacks older than ttlHours (stack CreationTime + ttlHours).
      // A static value keeps synth deterministic, so `cdk diff` stays quiet between runs.
      Tags.of(this).add('ttlHours', String(settings.prTtlHours));
    }

    const data = new Data(this, 'Data', { settings });
    const api = new Api(this, 'Api', { settings, table: data.table });
    const frontend = new Frontend(this, 'Frontend', { settings, apiUrl: api.url });
    new Ops(this, 'Ops', { settings, fn: api.fn, httpApi: api.httpApi });

    acknowledgeCdkHelpers(this, frontend);

    new CfnOutput(this, 'SiteUrl', { value: `https://${frontend.distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}

/**
 * BucketDeployment adds a helper Lambda that CDK itself owns (it copies site files to S3).
 * Its runtime, role and policy come from aws-cdk-lib, so its findings are acknowledged
 * here, one by one, because cdk-nag v3 has no bulk acknowledgement. Our own function
 * gets no such pass.
 */
function acknowledgeCdkHelpers(stack: Stack, frontend: Frontend): void {
  const helpers = stack.node.children.filter((c) => c.node.id.startsWith('Custom::CDKBucketDeployment'));
  const site = stack.getLogicalId(frontend.bucket.node.defaultChild as CfnElement);
  // With AWS credentials (a laptop, the deploy job) the account is a literal in the template;
  // without them (the gates job) it is a token. The finding ID differs, so match both.
  const account = Token.isUnresolved(stack.account) ? '<AWS::AccountId>' : stack.account;
  const qualifier = stack.node.tryGetContext('@aws-cdk/core:bootstrapQualifier') ?? DefaultStackSynthesizer.DEFAULT_QUALIFIER;
  const reason = 'CDK-managed BucketDeployment helper: runtime and IAM policy are set by aws-cdk-lib and scoped to the site bucket and the CDK assets bucket.';
  const ids = [
    'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
    'AwsSolutions-IAM5[Action::s3:GetBucket*]',
    'AwsSolutions-IAM5[Action::s3:GetObject*]',
    'AwsSolutions-IAM5[Action::s3:List*]',
    'AwsSolutions-IAM5[Action::s3:Abort*]',
    'AwsSolutions-IAM5[Action::s3:DeleteObject*]',
    'AwsSolutions-IAM5[Resource::*]',
    `AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:s3:::cdk-${qualifier}-assets-${account}-${stack.region}/*]`,
    `AwsSolutions-IAM5[Resource::<${site}.Arn>/*]`,
    'AwsSolutions-L1',
    'Serverless-LambdaDLQ',
    'Serverless-LambdaLatestVersion',
    'Serverless-LambdaTracing',
  ];
  for (const helper of helpers) {
    for (const id of ids) Validations.of(helper).acknowledge({ id, reason });
  }
}

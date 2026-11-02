import { CfnResource, Duration, Stack, Validations, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, aws_iam as iam, aws_logs as logs, aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { Settings, removalFor } from './settings';

export interface FrontendProps {
  readonly settings: Settings;
  /** Written to config.json next to index.html so the page knows where the API is. */
  readonly apiUrl: string;
}

/**
 * Private S3 bucket behind CloudFront with Origin Access Control.
 * The bucket is never public: Block Public Access on, TLS only, encrypted.
 * Works on *.cloudfront.net, so no certificate in us-east-1 is needed (profile A safe).
 */
export class Frontend extends Construct {
  readonly distribution: cloudfront.Distribution;
  readonly bucket: s3.Bucket;
  /** Role of the CDK BucketDeployment helper (its cdk-nag findings are acknowledged in app-stack.ts). */
  readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);
    const { settings } = props;
    const throwaway = settings.kind !== 'prod';

    // PR stacks write no access logs. CloudFront delivers standard logs minutes late, so a log
    // can land in the logs bucket after auto-delete emptied it, and the PR stack's delete fails
    // on a non-empty bucket (seen on baa-test-app#3, docs/FACT-CHECKS.md F25). App-dev and
    // App-prod keep their access logs.
    const logBucket = settings.kind === 'pr' ? undefined : new s3.Bucket(this, 'Logs', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // CloudFront standard logging writes with ACLs, so this bucket needs object writer ownership.
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: removalFor(settings),
      autoDeleteObjects: throwaway,
    });

    this.bucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // A prefix without a bucket would make the site bucket log into itself.
      ...(logBucket && { serverAccessLogsBucket: logBucket, serverAccessLogsPrefix: 's3/' }),
      versioned: settings.kind === 'prod',
      removalPolicy: removalFor(settings),
      autoDeleteObjects: throwaway,
    });

    this.distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `${settings.project} ${settings.stage}`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      ...(logBucket && { enableLogging: true, logBucket, logFilePrefix: 'cloudfront/' }),
    });

    if (!logBucket) {
      const reason = 'PR stack: no access logs, because a CloudFront log delivered after auto-delete keeps the logs bucket from being deleted (F25). The stack lives for hours; App-dev and App-prod log access.';
      Validations.of(this.bucket).acknowledge({ id: 'AwsSolutions-S1', reason });
      Validations.of(this.distribution).acknowledge({ id: 'AwsSolutions-CFR3', reason });
    }

    // The default *.cloudfront.net certificate keeps the blueprint free of us-east-1 resources,
    // which profile A projects cannot create. M2 adds a custom domain in profiles B and C.
    Validations.of(this.distribution).acknowledge({
      id: 'AwsSolutions-CFR4',
      reason: 'Default CloudFront certificate: TLS policy cannot be raised without a custom domain (M2, profiles B and C).',
    });
    Validations.of(this.distribution).acknowledge({
      id: 'AwsSolutions-CFR1',
      reason: 'Public site for a worldwide audience. Revisit if the brief restricts countries.',
    });
    Validations.of(this.distribution).acknowledge({
      id: 'AwsSolutions-CFR2',
      reason: 'No AWS WAF in M1: a web ACL costs money every month and is unavailable on CloudFront in profile A. API throttling limits abuse. Revisit in the WA checkpoint.',
    });

    // CDK's helper functions (BucketDeployment, S3 auto-delete) would log to /aws/lambda/<name>,
    // which Lambda creates outside the stack: it outlives a PR stack and never expires. Their own
    // log groups go with the stack. That alone is not enough: the helpers run once more while the
    // stack is deleted, their last log lines arrive seconds after CloudFormation deleted the log
    // group, and Lambda creates it again with the role's logs:CreateLogGroup (seen twice on
    // baa-test-app#3; a Deny on the role is removed before that moment). So, like the API
    // function, each helper role may only write to its own log group: no AWSLambdaBasicExecutionRole.
    const helperLogs = (id: string) => new logs.LogGroup(this, id, {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: removalFor(settings),
    });

    const deployLogs = helperLogs('DeployLogs');
    this.deployRole = new iam.Role(this, 'DeployRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'CDK BucketDeployment helper: copies site/ into the bucket, writes only its own log group',
    });
    deployLogs.grantWrite(this.deployRole);

    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '..', 'site')),
        s3deploy.Source.jsonData('config.json', { apiUrl: props.apiUrl }),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      role: this.deployRole,
      logGroup: deployLogs,
    });

    if (throwaway) {
      // autoDeleteObjects adds one provider per stack with neither a logGroup nor a role option.
      // Its bucket access comes from the bucket policies, so the role needs nothing but logs.
      const provider = Stack.of(this).node.tryFindChild('Custom::S3AutoDeleteObjectsCustomResourceProvider');
      const handler = provider?.node.tryFindChild('Handler') as CfnResource | undefined;
      const role = provider?.node.tryFindChild('Role') as CfnResource | undefined;
      if (!handler || !role) throw new Error('S3 auto-delete provider not found; aws-cdk-lib changed, update lib/frontend.ts');
      const autoDeleteLogs = helperLogs('AutoDeleteLogs');
      handler.addPropertyOverride('LoggingConfig.LogGroup', autoDeleteLogs.logGroupName);
      role.addPropertyDeletionOverride('ManagedPolicyArns');
      role.addPropertyOverride('Policies', [{
        PolicyName: 'OwnLogGroupOnly',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Action: ['logs:CreateLogStream', 'logs:PutLogEvents'], Resource: autoDeleteLogs.logGroupArn }],
        },
      }]);
    }
  }
}

import { CfnResource, Duration, Stack, Validations, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, aws_logs as logs, aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
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

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);
    const { settings } = props;
    const throwaway = settings.kind !== 'prod';

    const logBucket = new s3.Bucket(this, 'Logs', {
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
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 's3/',
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
      enableLogging: true,
      logBucket,
      logFilePrefix: 'cloudfront/',
    });

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
    // log groups go with the stack. The custom resource refers to the function and the function
    // to its log group, so CloudFormation deletes them in that order and the last (Delete)
    // invocation still has somewhere to write.
    const helperLogs = (id: string) => new logs.LogGroup(this, id, {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: removalFor(settings),
    });

    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '..', 'site')),
        s3deploy.Source.jsonData('config.json', { apiUrl: props.apiUrl }),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      logGroup: helperLogs('DeployLogs'),
    });

    if (throwaway) {
      // autoDeleteObjects adds one provider per stack; it has no logGroup option.
      const handler = Stack.of(this).node.tryFindChild('Custom::S3AutoDeleteObjectsCustomResourceProvider')
        ?.node.tryFindChild('Handler') as CfnResource | undefined;
      if (!handler) throw new Error('S3 auto-delete provider not found; aws-cdk-lib changed, update lib/frontend.ts');
      handler.addPropertyOverride('LoggingConfig.LogGroup', helperLogs('AutoDeleteLogs').logGroupName);
    }
  }
}

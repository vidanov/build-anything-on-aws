// Native oracle: these assertions read the synthesized CloudFormation template.
// They run in seconds, need no AWS account, and fail the build when a safe default is lost.
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/app-stack';
import { readSettings } from '../lib/settings';

function synth(stage: string): Template {
  const app = new App({ context: { 'baa:stage': stage, 'baa:region': 'eu-central-1', '@aws-cdk/core:permissionsBoundary': { name: 'baa-boundary' } } });
  const stack = new AppStack(app, `App-${stage}`, { settings: readSettings(app), env: { account: '111111111111', region: 'eu-central-1' } });
  return Template.fromStack(stack);
}

describe('S-001 site is private behind CloudFront', () => {
  const t = synth('pr-1');

  test('every bucket blocks public access and is encrypted', () => {
    const buckets = t.findResources('AWS::S3::Bucket');
    expect(Object.keys(buckets).length).toBeGreaterThan(0);
    for (const b of Object.values(buckets)) {
      expect(b.Properties.PublicAccessBlockConfiguration).toEqual({
        BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
      });
      expect(b.Properties.BucketEncryption).toBeDefined();
    }
  });

  test('CloudFront reads the bucket through Origin Access Control', () => {
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });
});

describe('S-002 and S-003 API', () => {
  const t = synth('pr-1');

  test('exactly the two public routes exist', () => {
    const keys = Object.values(t.findResources('AWS::ApiGatewayV2::Route')).map((r) => r.Properties.RouteKey).sort();
    expect(keys).toEqual(['GET /health', 'POST /visits']);
  });

  test('stage is throttled and writes access logs', () => {
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: Match.objectLike({ ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 }),
      AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
    });
  });

  test('table is on-demand with point-in-time recovery', () => {
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  test('no IAM statement allows every action', () => {
    for (const p of Object.values(t.findResources('AWS::IAM::Policy'))) {
      for (const s of p.Properties.PolicyDocument.Statement) {
        const actions = ([] as string[]).concat(s.Action);
        expect(actions).not.toContain('*');
      }
    }
  });
});

describe('S-006 alarms', () => {
  test('Lambda errors and API 5xx raise alarms on the alert topic', () => {
    const t = synth('pr-1');
    t.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    t.hasResourceProperties('AWS::CloudWatch::Alarm', { MetricName: 'Errors', Namespace: 'AWS/Lambda' });
    t.hasResourceProperties('AWS::CloudWatch::Alarm', { MetricName: '5xx', Namespace: 'AWS/ApiGateway' });
  });
});

describe('envelope contract', () => {
  test('every role carries the baa permissions boundary', () => {
    const t = synth('pr-1');
    const roles = t.findResources('AWS::IAM::Role');
    expect(Object.keys(roles).length).toBeGreaterThan(0);
    for (const r of Object.values(roles)) {
      expect(JSON.stringify(r.Properties.PermissionsBoundary)).toContain('policy/baa-boundary');
    }
  });
});

describe('S-008 and S-009 removal policy follows the stage', () => {
  test('PR stacks delete their data, prod keeps it', () => {
    const pr = synth('pr-7');
    const prod = synth('prod');
    for (const r of Object.values(pr.findResources('AWS::DynamoDB::Table'))) expect(r.DeletionPolicy).toBe('Delete');
    for (const r of Object.values(pr.findResources('AWS::S3::Bucket'))) expect(r.DeletionPolicy).toBe('Delete');
    for (const r of Object.values(prod.findResources('AWS::DynamoDB::Table'))) {
      expect(r.DeletionPolicy).toBe('Retain');
      expect(r.Properties.DeletionProtectionEnabled).toBe(true);
    }
    for (const r of Object.values(prod.findResources('AWS::S3::Bucket'))) expect(r.DeletionPolicy).toBe('Retain');
  });

  test('every function, CDK helpers included, logs to a log group that goes with the PR stack', () => {
    const pr = synth('pr-7');
    const groups = pr.findResources('AWS::Logs::LogGroup');
    const fns = Object.values(pr.findResources('AWS::Lambda::Function'));
    expect(fns.length).toBe(3);
    for (const fn of fns) {
      const group = groups[fn.Properties.LoggingConfig?.LogGroup?.Ref];
      expect(group).toBeDefined();
      expect(group.DeletionPolicy).toBe('Delete');
      expect(group.Properties.RetentionInDays).toBeGreaterThan(0);
    }
  });

  test('no function role can create a log group, so late log lines cannot recreate a deleted one', () => {
    const pr = synth('pr-7');
    const policies = Object.values(pr.findResources('AWS::IAM::Policy'));
    for (const fn of Object.values(pr.findResources('AWS::Lambda::Function'))) {
      const roleId = fn.Properties.Role['Fn::GetAtt'][0];
      const role = pr.findResources('AWS::IAM::Role')[roleId];
      const statements = [
        ...(role.Properties.Policies ?? []).flatMap((p: any) => p.PolicyDocument.Statement),
        ...policies.filter((p) => JSON.stringify(p.Properties.Roles).includes(roleId)).flatMap((p) => p.Properties.PolicyDocument.Statement),
      ];
      // A Deny is not enough: CloudFormation removes it before the role, while late log lines arrive.
      const allowsCreate = statements.some((s: any) => s.Effect === 'Allow' && [].concat(s.Action).some((a: string) => a === 'logs:CreateLogGroup' || a === 'logs:*'));
      expect(allowsCreate).toBe(false);
      expect(role.Properties.ManagedPolicyArns ?? []).toEqual([]);
    }
  });

  test('PR stacks write no access logs, so a late CloudFront log cannot block the delete; dev and prod keep them', () => {
    const pr = synth('pr-7');
    for (const b of Object.values(pr.findResources('AWS::S3::Bucket'))) expect(b.Properties.LoggingConfiguration).toBeUndefined();
    pr.hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: Match.objectLike({ Logging: Match.absent() }) });
    for (const stage of ['dev', 'prod']) {
      const t = synth(stage);
      t.hasResourceProperties('AWS::S3::Bucket', { LoggingConfiguration: Match.objectLike({ DestinationBucketName: Match.anyValue() }) });
      t.hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: Match.objectLike({ Logging: Match.objectLike({ Bucket: Match.anyValue() }) }) });
    }
  });

  test('stage names outside pr-<n>, dev, prod are rejected', () => {
    expect(() => synth('test')).toThrow(/baa:stage/);
  });
});

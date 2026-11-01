import { CfnElement, Duration, Stack, Validations, aws_apigatewayv2 as apigw, aws_apigatewayv2_integrations as integrations, aws_dynamodb as dynamodb, aws_iam as iam, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { Settings, removalFor } from './settings';

export interface ApiProps {
  readonly settings: Settings;
  readonly table: dynamodb.ITable;
}

/**
 * HTTP API -> one Lambda -> DynamoDB.
 * Public routes are listed in gates/guard/public-routes.guard and each one needs an ADR.
 */
export class Api extends Construct {
  readonly httpApi: apigw.HttpApi;
  readonly fn: lambda.Function;
  readonly url: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const { settings, table } = props;

    const fnLogs = new logs.LogGroup(this, 'FunctionLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: removalFor(settings),
    });

    // An explicit role instead of the AWS managed AWSLambdaBasicExecutionRole:
    // the function may write logs to its own log group only (AwsSolutions-IAM4).
    const role = new iam.Role(this, 'HandlerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'API handler: own log group, own table, X-Ray traces',
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [fnLogs.logGroupArn, `${fnLogs.logGroupArn}:log-stream:*`],
    }));

    this.fn = new lambda.Function(this, 'Handler', {
      role,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      logGroup: fnLogs,
      environment: { TABLE_NAME: table.tableName },
    });
    // Least privilege: read and write items in this one table, nothing else.
    table.grantReadWriteData(this.fn);
    // Exceptions to cdk-nag rules live next to the code they excuse, each with a reason.
    // docs/LEARNED.md explains the rule behind each one the first time it comes up.
    Validations.of(role).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::*]',
      reason: 'X-Ray PutTraceSegments and PutTelemetryRecords do not support resource-level permissions.',
    });
    Validations.of(role).acknowledge({
      id: `AwsSolutions-IAM5[Resource::<${Stack.of(this).getLogicalId(fnLogs.node.defaultChild as CfnElement)}.Arn>:log-stream:*]`,
      reason: 'Log stream names are created at runtime inside this one log group.',
    });
    Validations.of(this.fn).acknowledge({
      id: 'Serverless-LambdaDLQ',
      reason: 'Invoked synchronously by API Gateway. A dead-letter queue only applies to asynchronous invocations; errors return to the caller and raise the LambdaErrors alarm.',
    });

    const accessLogs = new logs.LogGroup(this, 'AccessLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: removalFor(settings),
    });

    this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      description: `${settings.project} ${settings.stage}`,
      createDefaultStage: false,
      // The page on CloudFront calls this API from another origin. The two routes are public
      // and read no cookies, so any origin is acceptable here. Tighten when auth arrives (M2).
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ['content-type'],
        maxAge: Duration.hours(1),
      },
    });

    const stage = this.httpApi.addStage('Stage', {
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
    });
    // L2 HttpStage has no access log property yet, so set it on the L1 resource.
    const cfnStage = stage.node.defaultChild as apigw.CfnStage;
    cfnStage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        routeKey: '$context.routeKey',
        status: '$context.status',
        latency: '$context.responseLatency',
        integrationError: '$context.integrationErrorMessage',
      }),
    };

    const integration = new integrations.HttpLambdaIntegration('Integration', this.fn);
    const routes = [
      this.httpApi.addRoutes({ path: '/health', methods: [apigw.HttpMethod.GET], integration }),
      this.httpApi.addRoutes({ path: '/visits', methods: [apigw.HttpMethod.POST], integration }),
    ].flat();

    // These two routes are public on purpose (see docs/adr/0001-public-routes.md).
    // Every other route must get an authorizer; public-routes.guard enforces the list.
    for (const route of routes) {
      Validations.of(route).acknowledge({
        id: 'AwsSolutions-APIG4',
        reason: 'Public by design: GET /health and POST /visits carry no personal data. ADR 0001, throttled at 10 rps.',
      });
    }

    this.url = `https://${this.httpApi.apiId}.execute-api.${Stack.of(this).region}.${Stack.of(this).urlSuffix}`;
  }
}

import { Duration, Validations, aws_apigatewayv2 as apigw, aws_cloudwatch as cw, aws_cloudwatch_actions as cwActions, aws_lambda as lambda, aws_sns as sns, aws_sns_subscriptions as subs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Settings } from './settings';

export interface OpsProps {
  readonly settings: Settings;
  readonly fn: lambda.IFunction;
  readonly httpApi: apigw.HttpApi;
}

/**
 * Alarms that tell a human when the app breaks. The budget lives in the
 * envelope (one per account), not here (one per stack would multiply).
 */
export class Ops extends Construct {
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: OpsProps) {
    super(scope, id);
    const { settings, fn, httpApi } = props;

    this.topic = new sns.Topic(this, 'Alerts', {
      displayName: `${settings.project} ${settings.stage} alerts`,
      enforceSSL: true,
    });
    if (settings.alertEmail) {
      const email = this.topic.addSubscription(new subs.EmailSubscription(settings.alertEmail));
      Validations.of(email).acknowledge({
        id: 'Serverless-SNSRedrivePolicy',
        reason: 'Email to the person who runs the app. A dead-letter queue needs SQS, which the cost allowlist leaves out, for a message whose alarm state CloudWatch keeps anyway.',
      });
    }

    const action = new cwActions.SnsAction(this.topic);

    const lambdaErrors = new cw.Alarm(this, 'LambdaErrors', {
      alarmDescription: 'The API function threw errors in the last 5 minutes.',
      metric: fn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrors.addAlarmAction(action);

    const api5xx = new cw.Alarm(this, 'Api5xx', {
      alarmDescription: 'The HTTP API returned 5xx responses in the last 5 minutes.',
      metric: httpApi.metricServerError({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    api5xx.addAlarmAction(action);
  }
}

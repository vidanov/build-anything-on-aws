import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Settings, removalFor } from './settings';

export interface DataProps {
  readonly settings: Settings;
}

/** One on-demand table with point-in-time recovery. No capacity to size, no idle cost. */
export class Data extends Construct {
  readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataProps) {
    super(scope, id);
    const { settings } = props;

    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: settings.kind === 'prod',
      removalPolicy: removalFor(settings),
    });
  }
}

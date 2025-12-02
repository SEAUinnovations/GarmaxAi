import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export function createStateTable(
  scope: Construct,
  stage: string
): dynamodb.Table {
  // DynamoDB table for tracking resource states during idle/restore cycles
  const stateTable = new dynamodb.Table(scope, `ResourceStateTable-${stage}`, {
    tableName: `garmaxai-resource-states-${stage}`,
    partitionKey: {
      name: 'resourceKey',
      type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    pointInTimeRecovery: true,
    stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    removalPolicy:
      stage === 'PROD'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
  });

  // GSI for querying current resource states
  stateTable.addGlobalSecondaryIndex({
    indexName: 'StateIndex',
    partitionKey: {
      name: 'state',
      type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
  });

  // GSI for querying by stage
  stateTable.addGlobalSecondaryIndex({
    indexName: 'StageIndex',
    partitionKey: {
      name: 'stage',
      type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
  });

  // Tags for cost allocation
  cdk.Tags.of(stateTable).add('Environment', stage);
  cdk.Tags.of(stateTable).add('CostCenter', 'Infrastructure');
  cdk.Tags.of(stateTable).add('AutoShutdown', 'false');
  cdk.Tags.of(stateTable).add('Purpose', 'IdleManagement');

  return stateTable;
}

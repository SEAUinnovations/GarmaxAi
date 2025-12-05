import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Stack } from 'aws-cdk-lib';

/**
 * Creates DynamoDB table to track resource state during teardown/restore cycles
 * 
 * Schema:
 * - Partition Key: resourceId (e.g., "RDS_CLUSTER#prod", "NAT_GATEWAY#prod")
 * - Sort Key: timestamp (ISO 8601 string)
 * - GSI: stage-index (partition: stage, sort: timestamp)
 * 
 * Used by teardown/restore orchestrators to maintain state consistency
 */
export default function createResourceStateTable(stack: Stack, stage: string): dynamodb.Table {
  const table = new dynamodb.Table(stack, `ResourceStateTable-${stage}`, {
    tableName: `garmaxai-resource-states-${stage}`,
    partitionKey: {
      name: 'resourceId',
      type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    pointInTimeRecovery: stage === 'prod',
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
  });

  // Add GSI for querying by stage
  table.addGlobalSecondaryIndex({
    indexName: 'stage-index',
    partitionKey: {
      name: 'stage',
      type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
  });

  new cdk.CfnOutput(stack, `ResourceStateTableName-${stage}`, {
    value: table.tableName,
    exportName: `ResourceStateTable-${stage}`,
  });

  return table;
}

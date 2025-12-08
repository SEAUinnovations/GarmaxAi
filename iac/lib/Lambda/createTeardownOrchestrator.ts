







import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Stack } from 'aws-cdk-lib';
import * as path from 'path';

interface TeardownOrchestratorProps {
  stage: string;
  vpc: ec2.IVpc;
  vpcSubnets: ec2.SubnetSelection;
  securityGroups: ec2.ISecurityGroup[];
  rdsClusterId: string;
  elasticacheClusterId?: string;
  ecsClusterName?: string;
  stateTableName: string;
}

/**
 * Creates Lambda function to orchestrate resource teardown during idle periods
 * 
 * Responsibilities:
 * - Stop RDS Aurora cluster
 * - Snapshot and delete ElastiCache cluster
 * - Scale ECS services to 0
 * - Invoke NAT Gateway manager for network teardown
 * - Store state in DynamoDB and Parameter Store
 * 
 * Triggered by EventBridge schedule or manual invocation
 */
export default function createTeardownOrchestrator(
  stack: Stack,
  props: TeardownOrchestratorProps
): lambda.Function {
  const { stage, vpc, vpcSubnets, securityGroups, rdsClusterId, elasticacheClusterId, ecsClusterName, stateTableName } = props;

  const teardownOrchestrator = new NodejsFunction(stack, `TeardownOrchestrator-${stage}`, {
    functionName: `GarmaxAi-TeardownOrchestrator-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'handler',
    entry: path.join(__dirname, '../../lambda-handlers/teardownOrchestrator/index.ts'),
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    vpc,
    vpcSubnets,
    securityGroups,
    environment: {
      STAGE: stage,
      RDS_CLUSTER_ID: rdsClusterId,
      ELASTICACHE_CLUSTER_ID: elasticacheClusterId || '',
      ECS_CLUSTER_NAME: ecsClusterName || '',
      STATE_TABLE_NAME: stateTableName,
    },
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'es2020',
      externalModules: ['@aws-sdk/*'],
    },
  });

  // Grant RDS permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds:StopDBCluster', 'rds:DescribeDBClusters', 'rds:ListTagsForResource'],
      resources: [`arn:aws:rds:${stack.region}:${stack.account}:cluster:*`],
    })
  );

  // Grant ElastiCache permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticache:CreateSnapshot',
        'elasticache:DeleteCacheCluster',
        'elasticache:DescribeCacheClusters',
        'elasticache:DescribeSnapshots',
      ],
      resources: ['*'],
    })
  );

  // Grant ECS permissions
  if (ecsClusterName) {
    teardownOrchestrator.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:UpdateService', 'ecs:DescribeServices', 'ecs:ListServices'],
        resources: [
          `arn:aws:ecs:${stack.region}:${stack.account}:service/${ecsClusterName}/*`,
          `arn:aws:ecs:${stack.region}:${stack.account}:cluster/${ecsClusterName}`,
        ],
      })
    );
  }

  // Grant Lambda invoke permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${stack.region}:${stack.account}:function:GarmaxAi-NATGatewayManager-${stage}`],
    })
  );

  // Grant DynamoDB permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
      resources: [`arn:aws:dynamodb:${stack.region}:${stack.account}:table/${stateTableName}`],
    })
  );

  // Grant SSM Parameter Store permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:PutParameter', 'ssm:GetParameter', 'ssm:DeleteParameter'],
      resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/idle-state/${stage}/*`],
    })
  );

  // Grant SNS permissions
  teardownOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish', 'sns:CreateTopic'],
      resources: [`arn:aws:sns:${stack.region}:${stack.account}:garmaxai-idle-notifications-${stage}`],
    })
  );

  return teardownOrchestrator;
}

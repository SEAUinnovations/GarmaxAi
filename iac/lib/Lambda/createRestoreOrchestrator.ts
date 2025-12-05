import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Stack } from 'aws-cdk-lib';
import * as path from 'path';

interface RestoreOrchestratorProps {
  stage: string;
  vpc: ec2.IVpc;
  vpcSubnets: ec2.SubnetSelection;
  securityGroups: ec2.ISecurityGroup[];
  stateTableName: string;
}

/**
 * Creates Lambda function to orchestrate resource restoration after idle period
 * 
 * Responsibilities:
 * - Start RDS Aurora cluster
 * - Recreate ElastiCache cluster from snapshot
 * - Restore ECS service desired counts
 * - Invoke NAT Gateway manager for network restoration
 * - Clean up state from DynamoDB and Parameter Store
 * 
 * Triggered by EventBridge activity detection or manual invocation
 */
export default function createRestoreOrchestrator(
  stack: Stack,
  props: RestoreOrchestratorProps
): lambda.Function {
  const { stage, vpc, vpcSubnets, securityGroups, stateTableName } = props;

  const restoreOrchestrator = new NodejsFunction(stack, `RestoreOrchestrator-${stage}`, {
    functionName: `GarmaxAi-RestoreOrchestrator-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'handler',
    entry: path.join(__dirname, '../../lambda-handlers/restoreOrchestrator/index.ts'),
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    vpc,
    vpcSubnets,
    securityGroups,
    environment: {
      STAGE: stage,
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
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds:StartDBCluster', 'rds:DescribeDBClusters'],
      resources: [`arn:aws:rds:${stack.region}:${stack.account}:cluster:*`],
    })
  );

  // Grant ElastiCache permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['elasticache:CreateCacheCluster', 'elasticache:DescribeCacheClusters', 'elasticache:DescribeSnapshots'],
      resources: ['*'],
    })
  );

  // Grant ECS permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecs:UpdateService', 'ecs:DescribeServices'],
      resources: ['*'],
    })
  );

  // Grant Lambda invoke permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${stack.region}:${stack.account}:function:GarmaxAi-NATGatewayManager-${stage}`],
    })
  );

  // Grant DynamoDB permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:DeleteItem'],
      resources: [`arn:aws:dynamodb:${stack.region}:${stack.account}:table/${stateTableName}`],
    })
  );

  // Grant SSM Parameter Store permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:DeleteParameter'],
      resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/idle-state/${stage}/*`],
    })
  );

  // Grant SNS permissions
  restoreOrchestrator.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: [`arn:aws:sns:${stack.region}:${stack.account}:garmaxai-idle-notifications-${stage}`],
    })
  );

  return restoreOrchestrator;
}

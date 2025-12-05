import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Stack } from 'aws-cdk-lib';
import * as path from 'path';

interface NATGatewayManagerProps {
  stage: string;
  vpc: ec2.IVpc;
  stateTableName: string;
}

/**
 * Creates Lambda function to manage NAT Gateway lifecycle
 * 
 * Responsibilities:
 * - Delete NAT Gateways and preserve Elastic IPs during teardown
 * - Recreate NAT Gateways and restore routes during restoration
 * - Store NAT Gateway configuration in Parameter Store
 * - Track state in DynamoDB
 * 
 * Invoked by teardown/restore orchestrators
 */
export default function createNATGatewayManager(
  stack: Stack,
  props: NATGatewayManagerProps
): lambda.Function {
  const { stage, vpc, stateTableName } = props;

  const natGatewayManager = new NodejsFunction(stack, `NATGatewayManager-${stage}`, {
    functionName: `GarmaxAi-NATGatewayManager-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'handler',
    entry: path.join(__dirname, '../../lambda-handlers/natGatewayManager/index.ts'),
    timeout: cdk.Duration.minutes(15),
    memorySize: 256,
    environment: {
      STAGE: stage,
      VPC_ID: vpc.vpcId,
      STATE_TABLE: stateTableName,
    },
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'es2020',
      externalModules: ['@aws-sdk/*'],
    },
  });

  // Grant EC2 NAT Gateway permissions
  natGatewayManager.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeNatGateways',
        'ec2:CreateNatGateway',
        'ec2:DeleteNatGateway',
        'ec2:DescribeAddresses',
        'ec2:AllocateAddress',
        'ec2:ReleaseAddress',
        'ec2:DescribeRouteTables',
        'ec2:CreateRoute',
        'ec2:DeleteRoute',
        'ec2:ReplaceRoute',
        'ec2:DescribeSubnets',
      ],
      resources: ['*'],
    })
  );

  // Grant DynamoDB permissions
  natGatewayManager.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
      resources: [`arn:aws:dynamodb:${stack.region}:${stack.account}:table/${stateTableName}`],
    })
  );

  // Grant SSM Parameter Store permissions
  natGatewayManager.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:PutParameter', 'ssm:GetParameter'],
      resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/idle-state/${stage}/*`],
    })
  );

  return natGatewayManager;
}

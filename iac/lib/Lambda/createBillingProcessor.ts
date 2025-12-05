import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Stack } from 'aws-cdk-lib';

interface CreateBillingProcessorProps {
  vpc?: ec2.IVpc;
  securityGroups?: ec2.ISecurityGroup[];
  vpcSubnets?: ec2.SubnetSelection;
  redisEndpoint?: string;
  redisPort?: string;
}

export default function createBillingProcessor(
  stack: Stack,
  stage: string,
  props?: CreateBillingProcessorProps
) {
  const { vpc, securityGroups, vpcSubnets, redisEndpoint, redisPort } = props || {};
  const role = new iam.Role(stack, `BillingProcessorRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Execution role for Billing (Stripe) processor Lambda',
  });

  role.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  );

  // Add VPC execution policy if VPC is configured
  if (vpc) {
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
  }

  // Environment variables
  const environment: { [key: string]: string } = {
    STAGE: stage,
  };
  if (redisEndpoint) environment.REDIS_ENDPOINT = redisEndpoint;
  if (redisPort) environment.REDIS_PORT = redisPort;

  const fn = new lambda.Function(stack, `BillingProcessor-${stage}`, {
    functionName: `GarmaxAi-BillingProcessor-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda-handlers/billingProcessor'),
    timeout: cdk.Duration.minutes(5), // Increased for VPC cold starts
    memorySize: 512,
    role,
    vpc,
    securityGroups,
    vpcSubnets,
    environment,
  });

  new cdk.CfnOutput(stack, `BillingProcessorArn-${stage}`, {
    value: fn.functionArn,
    exportName: `BillingProcessorArn-${stage}`,
    description: 'Billing (Stripe) Processor Lambda ARN',
  });

  return fn;
}

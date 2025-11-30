import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

export default function createBillingProcessor(
  stack: Stack,
  stage: string,
) {
  const role = new iam.Role(stack, `BillingProcessorRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Execution role for Billing (Stripe) processor Lambda',
  });

  role.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  );

  const fn = new lambda.Function(stack, `BillingProcessor-${stage}`, {
    functionName: `GarmaxAi-BillingProcessor-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda-handlers/billingProcessor'),
    timeout: cdk.Duration.minutes(2),
    memorySize: 512,
    role,
    environment: {
      STAGE: stage,
    },
  });

  new cdk.CfnOutput(stack, `BillingProcessorArn-${stage}`, {
    value: fn.functionArn,
    exportName: `BillingProcessorArn-${stage}`,
    description: 'Billing (Stripe) Processor Lambda ARN',
  });

  return fn;
}

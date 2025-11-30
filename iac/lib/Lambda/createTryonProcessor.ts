import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { env } from '../../../parameters/config';

export default function createTryonProcessor(
  stack: Stack,
  stage: string,
  vpc?: IVpc,
) {
  // Lambda execution role
  const tryonProcessorRole = new iam.Role(stack, `TryonProcessorRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Execution role for Try-On processor Lambda',
  });

  // Attach basic Lambda execution policy
  tryonProcessorRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  );

  // VPC execution policy (if VPC is provided)
  if (vpc) {
    tryonProcessorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
  }

  // Add permissions for S3, Rekognition, Secrets Manager
  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [
        `arn:aws:s3:::${env.S3_BUCKET || 'user-uploads'}/*`,
        `arn:aws:s3:::tryon-renders/*`,
      ],
    })
  );

  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rekognition:DetectLabels',
        'rekognition:DetectText',
      ],
      resources: ['*'],
    })
  );

  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: ['*'], // Narrow this down in production
    })
  );

  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutEvents',
      ],
      resources: [
        `arn:aws:events:${stack.region}:${stack.account}:event-bus/GarmaxAi-Tryon-${stage}`,
      ],
    })
  );

  // Create Lambda function
  const tryonProcessor = new lambda.Function(stack, `TryonProcessor-${stage}`, {
    functionName: `GarmaxAi-TryonProcessor-${stage}`,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda-handlers/tryonProcessor'),
    timeout: cdk.Duration.minutes(5),
    memorySize: 1024,
    role: tryonProcessorRole,
    environment: {
      STAGE: stage,
      S3_BUCKET: env.S3_BUCKET || 'user-uploads',
      EVENT_BUS_NAME: `GarmaxAi-Tryon-${stage}`,
      DATABASE_URL: process.env.DATABASE_URL || '',
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
    },
    vpc: vpc,
  });

  // Grant SQS permissions (will be added by event source mapping)
  new cdk.CfnOutput(stack, `TryonProcessorArn-${stage}`, {
    value: tryonProcessor.functionArn,
    exportName: `TryonProcessorArn-${stage}`,
    description: 'Try-On Processor Lambda ARN',
  });

  return tryonProcessor;
}

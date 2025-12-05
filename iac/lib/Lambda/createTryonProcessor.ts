import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Stack } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { env } from '../../../parameters/config';

interface CreateTryonProcessorProps {
  uploadsBucket: s3.Bucket;
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  smplAssetsBucket?: s3.Bucket;
  vpc?: ec2.IVpc;
  securityGroups?: ec2.ISecurityGroup[];
  vpcSubnets?: ec2.SubnetSelection;
  redisEndpoint?: string;
  redisPort?: string;
}

export default function createTryonProcessor(
  stack: Stack,
  stage: string,
  props: CreateTryonProcessorProps,
) {
  const { uploadsBucket, guidanceBucket, rendersBucket, smplAssetsBucket, vpc, securityGroups, vpcSubnets, redisEndpoint, redisPort } = props;
  
  // Lambda execution role with scoped permissions
  const tryonProcessorRole = new iam.Role(stack, `TryonProcessorRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Execution role for Try-On processor Lambda with scoped S3 access',
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

  // Scoped S3 permissions for try-on processing
  // READ: uploads bucket for user photos and garment references
  uploadsBucket.grantRead(tryonProcessorRole, 'avatars/*');
  uploadsBucket.grantRead(tryonProcessorRole, 'garments/*');
  
  // WRITE: guidance bucket for SMPL-generated assets
  guidanceBucket.grantWrite(tryonProcessorRole, 'depth/*');
  guidanceBucket.grantWrite(tryonProcessorRole, 'normals/*');
  guidanceBucket.grantWrite(tryonProcessorRole, 'poses/*');
  guidanceBucket.grantWrite(tryonProcessorRole, 'segments/*');
  guidanceBucket.grantWrite(tryonProcessorRole, 'prompts/*');
  
  // WRITE: renders bucket for preview generation
  rendersBucket.grantWrite(tryonProcessorRole, 'previews/*');
  rendersBucket.grantWrite(tryonProcessorRole, 'processing/*');
  
  // READ: SMPL assets bucket (only if processing locally, not via ECS)
  if (smplAssetsBucket) {
    smplAssetsBucket.grantRead(tryonProcessorRole, 'models/*');
    smplAssetsBucket.grantRead(tryonProcessorRole, 'weights/*');
    smplAssetsBucket.grantRead(tryonProcessorRole, 'configs/*');
  }

  // EventBridge permissions for publishing render requests
  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [
        `arn:aws:events:${stack.region}:${stack.account}:event-bus/GarmaxAi-Tryon-${stage}`,
      ],
    })
  );
  
  // CloudWatch metrics for monitoring and budget tracking
  tryonProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': ['GarmaxAi/TryOn', 'GarmaxAi/Budget'],
        },
      },
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
      // S3 bucket configurations
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      GUIDANCE_BUCKET: guidanceBucket.bucketName,
      RENDERS_BUCKET: rendersBucket.bucketName,
      SMPL_ASSETS_BUCKET: smplAssetsBucket?.bucketName || '',
      // Event and API configurations
      EVENT_BUS_NAME: `GarmaxAi-Tryon-${stage}`,
      DATABASE_URL: process.env.DATABASE_URL || '',
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
      // SMPL processing configuration
      SMPL_PROCESSING_MODE: env.SMPL_PROCESSING_MODE || 'LAMBDA',
      ECS_CLUSTER_NAME: env.ECS_CLUSTER_NAME || '',
      ECS_TASK_DEFINITION: env.ECS_TASK_DEFINITION || '',
      // Redis configuration
      ...(redisEndpoint && { REDIS_ENDPOINT: redisEndpoint }),
      ...(redisPort && { REDIS_PORT: redisPort }),
    },
    vpc,
    securityGroups,
    vpcSubnets,
  });

  // Grant SQS permissions (will be added by event source mapping)
  new cdk.CfnOutput(stack, `TryonProcessorArn-${stage}`, {
    value: tryonProcessor.functionArn,
    exportName: `TryonProcessorArn-${stage}`,
    description: 'Try-On Processor Lambda ARN',
  });

  return tryonProcessor;
}

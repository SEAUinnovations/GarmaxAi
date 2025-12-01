/**
 * AI Render Processor Lambda
 * 
 * Creates the Lambda function responsible for generating photorealistic renders
 * from 3D try-on previews using AI diffusion models (Replicate-first, Bedrock failover).
 * 
 * Architecture:
 * - Triggered by EventBridge on 'tryon.render.requested' events
 * - Reads guidance assets (depth, normal maps) from guidance bucket
 * - Calls external rendering service (Replicate/Bedrock) with ControlNet
 * - Uploads final renders to renders bucket
 * - Updates session status and notifies via WebSocket
 * 
 * Provider Strategy:
 * - Primary: Replicate (cost-effective, external scaling)
 * - Failover: Bedrock (feature-gated OFF by default)
 * - Future: ECS GPU tasks for premium quality tiers
 * 
 * Security:
 * - Scoped IAM: read guidance/previews, write final renders only
 * - Secrets Manager access for Replicate API token
 * - Conditional Bedrock permissions (only if failover enabled)
 * - No access to SMPL assets or user uploads directly
 * 
 * Cost Controls:
 * - Circuit breaker for failover attempts (DynamoDB/SSM counters)
 * - Budget tracking via CloudWatch custom metrics
 * - Per-user quota enforcement before processing
 * - Error taxonomy to avoid unnecessary failovers
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { env } from '../../../parameters/config';

interface CreateAiRenderProcessorProps {
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  allowBedrockFailover?: boolean;
}

export default function createAiRenderProcessor(
  stack: cdk.Stack,
  stage: string,
  props: CreateAiRenderProcessorProps
) {
  const { guidanceBucket, rendersBucket, allowBedrockFailover = false } = props;
  
  // Lambda function for AI rendering
  const aiRenderProcessor = new NodejsFunction(stack, `AiRenderProcessor-${stage}`, {
    functionName: `GarmaxAi-AiRenderProcessor-${stage}`,
    entry: `${__dirname}/../../lambda-handlers/aiRenderProcessor/index.ts`,
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_18_X,
    
    // Resource allocation for AI API calls and image processing
    timeout: cdk.Duration.minutes(10), // Allow time for external API calls
    memorySize: 1024, // Sufficient for image processing and API responses
    
    // Environment variables for bucket access and provider configuration
    environment: {
      // Bucket configuration
      GUIDANCE_BUCKET_NAME: guidanceBucket.bucketName,
      RENDERS_BUCKET_NAME: rendersBucket.bucketName,
      
      // Provider configuration
      RENDER_PROVIDER: env.RENDER_PROVIDER || 'replicate',
      ALLOW_BEDROCK_FAILOVER: allowBedrockFailover.toString(),
      
      // Budget and quota controls
      BEDROCK_MAX_FAILOVER_PER_MIN: env.BEDROCK_MAX_FAILOVER_PER_MIN || '5',
      BEDROCK_DAILY_BUDGET_USD: env.BEDROCK_DAILY_BUDGET_USD || '100',
      MAX_RENDERS_PER_USER_DAILY: env.MAX_RENDERS_PER_USER_DAILY || '50',
      
      // EventBridge configuration for status updates
      EVENT_BUS_NAME: env.EVENT_BUS_NAME || `GarmaxAi-Tryon-${stage}`,
      
      // AWS region and stage for service configuration
      AWS_REGION: stack.region,
      STAGE: stage,
    },
    
    // Bundle configuration for Node.js dependencies
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'es2020',
      externalModules: [
        'aws-sdk', // Use AWS SDK v2 from Lambda runtime
      ],
    },
  });
  
  // IAM permissions for S3 bucket access
  
  // Read access to guidance assets (depth maps, normal maps, prompts)
  guidanceBucket.grantRead(aiRenderProcessor, 'depth/*');
  guidanceBucket.grantRead(aiRenderProcessor, 'normals/*');
  guidanceBucket.grantRead(aiRenderProcessor, 'poses/*');
  guidanceBucket.grantRead(aiRenderProcessor, 'prompts/*');
  guidanceBucket.grantRead(aiRenderProcessor, 'controlnets/*');
  
  // Read access to preview renders from try-on processor
  rendersBucket.grantRead(aiRenderProcessor, 'previews/*');
  
  // Write access to final render outputs
  rendersBucket.grantWrite(aiRenderProcessor, 'final/*');
  rendersBucket.grantWrite(aiRenderProcessor, 'thumbnails/*');
  rendersBucket.grantWrite(aiRenderProcessor, 'processing/*'); // Temp processing files
  
  // EventBridge permissions for publishing status updates
  aiRenderProcessor.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${stack.region}:${stack.account}:event-bus/GarmaxAi-Tryon-${stage}`],
    })
  );
  
  // Secrets Manager access for Replicate API token
  aiRenderProcessor.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:replicate-api-token*`],
    })
  );
  
  // CloudWatch custom metrics for budget tracking
  aiRenderProcessor.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'], // CloudWatch metrics don't support resource-level permissions
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': ['GarmaxAi/Rendering', 'GarmaxAi/Budget'],
        },
      },
    })
  );
  
  // DynamoDB/SSM permissions for circuit breaker and quota tracking
  aiRenderProcessor.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [
        `arn:aws:dynamodb:${stack.region}:${stack.account}:table/GarmaxAi-RenderQuotas-${stage}`,
        `arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/${stage}/render/*`,
      ],
    })
  );
  
  // Conditional Bedrock permissions (only if failover enabled)
  if (allowBedrockFailover) {
    aiRenderProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:ListFoundationModels',
        ],
        resources: [
          `arn:aws:bedrock:${stack.region}::foundation-model/stability.stable-diffusion-xl-v1`,
          `arn:aws:bedrock:${stack.region}::foundation-model/amazon.titan-image-generator-v1`,
        ],
      })
    );
    
    // Bedrock API token from Secrets Manager (if different from Replicate)
    aiRenderProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:bedrock-api-credentials*`],
      })
    );
  }
  
  // CloudFormation outputs
  new cdk.CfnOutput(stack, `AiRenderProcessorArn-${stage}`, {
    value: aiRenderProcessor.functionArn,
    exportName: `AiRenderProcessorArn-${stage}`,
    description: `AI Render Processor Lambda ARN for ${stage} environment`,
  });
  
  new cdk.CfnOutput(stack, `AiRenderProcessorName-${stage}`, {
    value: aiRenderProcessor.functionName,
    exportName: `AiRenderProcessorName-${stage}`,
    description: `AI Render Processor Lambda name for ${stage} environment`,
  });
  
  return aiRenderProcessor;
}
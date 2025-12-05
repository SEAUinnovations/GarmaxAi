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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { env } from '../../../parameters/config';

interface CreateAiRenderProcessorProps {
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  allowBedrockFailover?: boolean;
  vpc?: ec2.IVpc;
  securityGroups?: ec2.ISecurityGroup[];
  vpcSubnets?: ec2.SubnetSelection;
  redisEndpoint?: string;
  redisPort?: string;
}

export default function createAiRenderProcessor(
  stack: cdk.Stack,
  stage: string,
  props: CreateAiRenderProcessorProps
) {
  const { guidanceBucket, rendersBucket, allowBedrockFailover = false, vpc, securityGroups, vpcSubnets, redisEndpoint, redisPort } = props;
  
  // Lambda execution role
  const aiRenderProcessorRole = new iam.Role(stack, `AiRenderProcessorRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Execution role for AI Render Processor Lambda',
  });

  // Add basic Lambda execution policy
  aiRenderProcessorRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  );

  // Add VPC execution policy if VPC is configured
  if (vpc) {
    aiRenderProcessorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
  }

  // Lambda function for AI rendering
  const aiRenderProcessor = new NodejsFunction(stack, `AiRenderProcessor-${stage}`, {
    functionName: `GarmaxAi-AiRenderProcessor-${stage}`,
    entry: `${__dirname}/../../lambda-handlers/aiRenderProcessor/index.ts`,
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_18_X,
    
    // Resource allocation for AI API calls and image processing
    timeout: cdk.Duration.minutes(10), // Allow time for external API calls
    memorySize: 1024, // Sufficient for image processing and API responses
    role: aiRenderProcessorRole,
    
    // VPC configuration
    vpc,
    securityGroups,
    vpcSubnets,
    
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
      
      // AWS stage for service configuration
      STAGE: stage,
      
      // Redis configuration
      ...(redisEndpoint && { REDIS_ENDPOINT: redisEndpoint }),
      ...(redisPort && { REDIS_PORT: redisPort }),
    },
    
    // Bundle configuration for Node.js dependencies
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'es2020',
      externalModules: [
        'aws-sdk', // Use AWS SDK v2 from Lambda runtime
        '@aws-sdk/*', // AWS SDK v3 modules
      ],
    },
  });
  
  // IAM permissions for S3 bucket access
  
  // Read access to guidance assets (depth maps, normal maps, prompts)
  guidanceBucket.grantRead(aiRenderProcessorRole, 'depth/*');*');
  guidanceBucket.grantRead(aiRenderProcessorRole, 'normals/*');
  guidanceBucket.grantRead(aiRenderProcessorRole, 'poses/*');
  guidanceBucket.grantRead(aiRenderProcessorRole, 'prompts/*');
  guidanceBucket.grantRead(aiRenderProcessorRole, 'controlnets/*');
  
  // Read access to preview renders from try-on processor
  rendersBucket.grantRead(aiRenderProcessorRole, 'previews/*');
  
  // Write access to final render outputs
  rendersBucket.grantWrite(aiRenderProcessorRole, 'final/*');
  rendersBucket.grantWrite(aiRenderProcessorRole, 'thumbnails/*');
  rendersBucket.grantWrite(aiRenderProcessorRole, 'processing/*'); // Temp processing files
  
  // EventBridge permissions for publishing status updates
  aiRenderProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${stack.region}:${stack.account}:event-bus/GarmaxAi-Tryon-${stage}`],
    })
  );
  
  // Secrets Manager access for Replicate API token
  aiRenderProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:replicate-api-token*`],
    })
  );
  
  // CloudWatch custom metrics for budget tracking
  aiRenderProcessorRole.addToPolicy(
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
  // Also includes Gemini service account credentials and budget tracking
  aiRenderProcessorRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [
        // Existing render quotas table
        `arn:aws:dynamodb:${stack.region}:${stack.account}:table/GarmaxAi-RenderQuotas-${stage}`,
        
        // Gemini budget tracking table
        `arn:aws:dynamodb:${stack.region}:${stack.account}:table/gemini_budget_tracking_${stage}`,
        
        // Existing SSM parameters for render configuration
        `arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/${stage}/render/*`,
        
        // Gemini-specific SSM parameters (hierarchical path structure)
        // Includes: service-account-json, traffic-percent, batch-settings, etc.
        `arn:aws:ssm:${stack.region}:${stack.account}:parameter/garmaxai/gemini/${stage}/*`,
      ],
    })
  );
  
  // Conditional Bedrock permissions (only if failover enabled)
  if (allowBedrockFailover) {
    aiRenderProcessorRole.addToPolicy(
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
    aiRenderProcessorRole.addToPolicy(
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
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import createPythonLambda from './Lambda/createLambda';
import createApiGateway from './Api/createApiGateway';
import createCloudfront from './Cloudfront/createCloudfront';
import createFrontend from './Cloudfront/createFrontend';
import createVpc from './VPC/createVPC';
import { env } from '../../parameters/config';
import createStaticSiteBucket from './Storage/createStaticSiteBucket';
// Import new separate bucket creators
import createUploadsBucket from './Storage/createUploadsBucket';
import createGuidanceBucket from './Storage/createGuidanceBucket';
import createRendersBucket from './Storage/createRendersBucket';
import createSmplAssetsBucket from './Storage/createSmplAssetsBucket';
import createLogsBucket from './Storage/createLogsBucket';
// Import SQS and EventBridge
import createTryonQueue from './SQS/createTryonQueue';
import createTryonEventBus from './EventBridge/createTryonEventBus';
import * as iam from 'aws-cdk-lib/aws-iam';
import createBillingQueue from './SQS/createBillingQueue';
// Import Lambda functions
import createBillingProcessor from './Lambda/createBillingProcessor';
import createAiRenderProcessor from './Lambda/createAiRenderProcessor';
import createTryonProcessor from './Lambda/createTryonProcessor';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
// Import ECS infrastructure
import createEcrRepository from './ECR/createEcrRepository';
import createEcsCluster from './ECS/createEcsCluster';

export class GarmaxAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = createVpc(this, this.region || cdk.Stack.of(this).region);

    // Create a Python Lambda
    const pythonLambda = createPythonLambda(this, 'ModelMeApiLambda');

    // Create API Gateway (RestApi) and integrate with Lambda
    const api = createApiGateway(this, pythonLambda, 'ModelMeApi');

    // Create centralized logs bucket first (other buckets will reference it)
    const logsBucket = createLogsBucket(this, env.STAGE);
    
    // Create separate S3 buckets for different use cases with proper security and lifecycle
    const uploadsBucket = createUploadsBucket(this, env.STAGE, logsBucket);
    const guidanceBucket = createGuidanceBucket(this, env.STAGE, logsBucket);
    const rendersBucket = createRendersBucket(this, env.STAGE, logsBucket);
    const smplAssetsBucket = createSmplAssetsBucket(this, env.STAGE, logsBucket);
    
    // Create ECS infrastructure for heavy SMPL processing (optional based on feature flag)
    const ecrRepository = createEcrRepository(this, env.STAGE);
    
    // Create ECS cluster and task definition for compute-intensive SMPL jobs
    const ecsInfrastructure = env.ENABLE_ECS_HEAVY_JOBS ? createEcsCluster(
      this, 
      env.STAGE, 
      {
        vpc,
        uploadsBucket,
        guidanceBucket,
        rendersBucket,
        smplAssetsBucket,
        ecrRepository
      }
    ) : null;

    // Create SQS queues and EventBridge bus for event-driven processing
    const { tryonQueue } = createTryonQueue(this, env.STAGE);
    const { billingQueue } = createBillingQueue(this, env.STAGE);

    // Create separate Lambda functions for different processing stages
    
    // 1. Try-On Processor: SMPL estimation and guidance asset generation
    const tryonProcessor = createTryonProcessor(this, env.STAGE, {
      uploadsBucket,
      guidanceBucket,
      rendersBucket,
      smplAssetsBucket: env.ENABLE_ECS_HEAVY_JOBS ? undefined : smplAssetsBucket,
    });
    
    // Subscribe tryonProcessor to SQS for reliable processing
    tryonProcessor.addEventSource(new SqsEventSource(tryonQueue, {
      batchSize: 1, // Process sessions individually for better error handling
      reportBatchItemFailures: true,
    }));
    
    // 2. AI Render Processor: Replicate/Bedrock rendering with failover
    const aiRenderProcessor = createAiRenderProcessor(this, env.STAGE, {
      guidanceBucket,
      rendersBucket,
      allowBedrockFailover: env.ALLOW_BEDROCK_FAILOVER,
    });
    
    // 3. Billing Processor: Stripe event handling and credit management
    const billingProcessor = createBillingProcessor(this, env.STAGE);
    billingProcessor.addEventSource(new SqsEventSource(billingQueue, {
      batchSize: 5, // Can batch billing events for efficiency
      reportBatchItemFailures: true,
    }));
    
    // Create EventBridge bus with all Lambda targets wired
    const tryonBus = createTryonEventBus(
      this, 
      env.STAGE, 
      tryonQueue, 
      billingQueue,
      tryonProcessor, // Optional direct invocation (currently disabled)
      aiRenderProcessor // Direct invocation for render requests
    );

    // Allow Lambda to publish to the EventBridge bus
    pythonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [tryonBus.eventBusArn],
    }));

    // Configure environment variables for all Lambda functions
    
    // API Lambda: EventBridge publishing and basic bucket access
    pythonLambda.addEnvironment('EVENTBRIDGE_BUS_NAME', tryonBus.eventBusName);
    pythonLambda.addEnvironment('SQS_QUEUE_URL', tryonQueue.queueUrl);
    pythonLambda.addEnvironment('SQS_BILLING_QUEUE_URL', billingQueue.queueUrl);
    pythonLambda.addEnvironment('UPLOADS_BUCKET_NAME', uploadsBucket.bucketName);
    
    // Try-On Processor: Bucket access and processing configuration
    tryonProcessor.addEnvironment('UPLOADS_BUCKET_NAME', uploadsBucket.bucketName);
    tryonProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', guidanceBucket.bucketName);
    tryonProcessor.addEnvironment('RENDERS_BUCKET_NAME', rendersBucket.bucketName);
    if (!env.ENABLE_ECS_HEAVY_JOBS && smplAssetsBucket) {
      tryonProcessor.addEnvironment('SMPL_ASSETS_BUCKET_NAME', smplAssetsBucket.bucketName);
    }
    tryonProcessor.addEnvironment('EVENT_BUS_NAME', tryonBus.eventBusName);
    tryonProcessor.addEnvironment('MAX_TRYONS_PER_USER_DAILY', env.MAX_TRYONS_PER_USER_DAILY);
    
    // ECS configuration for heavy SMPL processing
    if (env.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      tryonProcessor.addEnvironment('ECS_CLUSTER_NAME', ecsInfrastructure.cluster.clusterName);
      tryonProcessor.addEnvironment('ECS_TASK_DEFINITION_ARN', ecsInfrastructure.taskDefinition.taskDefinitionArn);
      tryonProcessor.addEnvironment('ECS_SUBNET_IDS', vpc.privateSubnets.map(subnet => subnet.subnetId).join(','));
    }
    
    // AI Render Processor: Rendering configuration and provider settings
    aiRenderProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', guidanceBucket.bucketName);
    aiRenderProcessor.addEnvironment('RENDERS_BUCKET_NAME', rendersBucket.bucketName);
    aiRenderProcessor.addEnvironment('EVENT_BUS_NAME', tryonBus.eventBusName);
    aiRenderProcessor.addEnvironment('RENDER_PROVIDER', env.RENDER_PROVIDER);
    aiRenderProcessor.addEnvironment('ALLOW_BEDROCK_FAILOVER', env.ALLOW_BEDROCK_FAILOVER.toString());
    aiRenderProcessor.addEnvironment('BEDROCK_MAX_FAILOVER_PER_MIN', env.BEDROCK_MAX_FAILOVER_PER_MIN);
    aiRenderProcessor.addEnvironment('BEDROCK_DAILY_BUDGET_USD', env.BEDROCK_DAILY_BUDGET_USD);
    aiRenderProcessor.addEnvironment('MAX_RENDERS_PER_USER_DAILY', env.MAX_RENDERS_PER_USER_DAILY);
    
    // Billing Processor: Queue access only (no S3 buckets needed)
    billingProcessor.addEnvironment('EVENT_BUS_NAME', tryonBus.eventBusName);

    // Determine the API domain for CloudFront origin
    const region = this.region || cdk.Stack.of(this).region;
    const backendDomain = (env as any).backendDomainName || `backend.${env.hostedZoneName}`;
    const apiDomain = api.addDomainName('ApiDomain', {
      domainName: backendDomain,
      certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'ApiCertificate',
        (env as any).BackendAcmCert?.[region]?.id || env.AcmCert[region].id
      ),
    }).domainName;

    // Create CloudFront distribution that points to API Gateway and add Route53 record
    const apiDist = createCloudfront(this, env.STAGE, region, undefined, apiDomain, `/${api.deploymentStage?.stageName ?? ''}`);

    // Frontend static hosting: S3 bucket + CloudFront + custom domain + WAF
    const siteBucket = createStaticSiteBucket(this, env.STAGE);

    const frontendDomain = (env as any).frontendDomainName
      ? (env as any).frontendDomainName
      : env.hostedZoneName;

    const feDist = createFrontend(this, env.STAGE, siteBucket, {
      region,
      domainName: frontendDomain,
      wafArn: (env as any).wafArn,
    });

    new cdk.CfnOutput(this, `FrontendBucketName-${env.STAGE}`, {
      value: siteBucket.bucketName,
      exportName: `FrontendBucketName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `FrontendDistributionId-${env.STAGE}`, {
      value: feDist.distributionId,
      exportName: `FrontendDistributionId-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionId-${env.STAGE}`, {
      value: apiDist.distributionId,
      exportName: `BackendDistributionId-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionDomainName-${env.STAGE}`, {
      value: apiDist.distributionDomainName,
      exportName: `BackendDistributionDomainName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `EventBridgeBusName-${env.STAGE}`, {
      value: tryonBus.eventBusName,
      exportName: `EventBridgeBusName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `TryonQueueUrl-${env.STAGE}`, {
      value: tryonQueue.queueUrl,
      exportName: `TryonQueueUrl-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BillingQueueUrl-${env.STAGE}`, {
      value: billingQueue.queueUrl,
      exportName: `BillingQueueUrl-${env.STAGE}`,
    });
    
    // S3 bucket outputs for external reference and ops
    new cdk.CfnOutput(this, `UploadsBucketName-${env.STAGE}`, {
      value: uploadsBucket.bucketName,
      exportName: `UploadsBucketName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `GuidanceBucketName-${env.STAGE}`, {
      value: guidanceBucket.bucketName,
      exportName: `GuidanceBucketName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `RendersBucketName-${env.STAGE}`, {
      value: rendersBucket.bucketName,
      exportName: `RendersBucketName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `SmplAssetsBucketName-${env.STAGE}`, {
      value: smplAssetsBucket.bucketName,
      exportName: `SmplAssetsBucketName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `LogsBucketName-${env.STAGE}`, {
      value: logsBucket.bucketName,
      exportName: `LogsBucketName-${env.STAGE}`,
    });
    
    // Lambda function outputs for monitoring and debugging
    new cdk.CfnOutput(this, `TryonProcessorName-${env.STAGE}`, {
      value: tryonProcessor.functionName,
      exportName: `TryonProcessorName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `AiRenderProcessorName-${env.STAGE}`, {
      value: aiRenderProcessor.functionName,
      exportName: `AiRenderProcessorName-${env.STAGE}`,
    });
    
    new cdk.CfnOutput(this, `BillingProcessorName-${env.STAGE}`, {
      value: billingProcessor.functionName,
      exportName: `BillingProcessorName-${env.STAGE}`,
    });
    
    // ECS infrastructure outputs (if enabled)
    if (env.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      new cdk.CfnOutput(this, `EcsClusterArn-${env.STAGE}`, {
        value: ecsInfrastructure.cluster.clusterArn,
        exportName: `EcsClusterArn-${env.STAGE}`,
      });
      
      new cdk.CfnOutput(this, `EcsTaskDefinitionFamily-${env.STAGE}`, {
        value: ecsInfrastructure.taskDefinition.family,
        exportName: `EcsTaskDefinitionFamily-${env.STAGE}`,
      });
    }
  }
}

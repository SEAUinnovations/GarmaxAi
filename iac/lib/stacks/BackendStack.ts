import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import createPythonLambda from '../Lambda/createLambda';
import createApiGateway from '../Api/createApiGateway';
import createTryonQueue from '../SQS/createTryonQueue';
import createBillingQueue from '../SQS/createBillingQueue';
import createGeminiBatchQueue from '../SQS/createGeminiBatchQueue';
import createTryonEventBus from '../EventBridge/createTryonEventBus';
import createBillingProcessor from '../Lambda/createBillingProcessor';
import createAiRenderProcessor from '../Lambda/createAiRenderProcessor';
import createTryonProcessor from '../Lambda/createTryonProcessor';
import createEcrRepository from '../ECR/createEcrRepository';
import createEcsCluster from '../ECS/createEcsCluster';
import createBudgetMonitoring from '../Monitoring/createBudgetMonitoring';
import { grantReadApiKeys, type ApiKeyParameters } from '../ParameterStore';

export interface BackendStackProps extends cdk.NestedStackProps {
  stage: string;
  vpc: ec2.Vpc;
  uploadsBucket: s3.Bucket;
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  smplAssetsBucket: s3.Bucket;
  apiKeyParameters: ApiKeyParameters;
  env: any; // Environment configuration
}

/**
 * BackendStack - Manages backend application infrastructure
 * - API Gateway and Lambda functions
 * - ECS cluster for SMPL processing
 * - SQS queues and EventBridge
 * - Lambda processors (try-on, AI render, billing)
 * - Budget monitoring
 */
export class BackendStack extends cdk.NestedStack {
  public readonly apiGateway: cdk.aws_apigateway.RestApi;
  public readonly tryonEventBus: cdk.aws_events.EventBus;
  public readonly tryonQueueUrl: string;
  public readonly billingQueueUrl: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Create API Lambda
    const pythonLambda = createPythonLambda(this, 'ModelMeApiLambda');

    // Create API Gateway (RestApi) and integrate with Lambda
    this.apiGateway = createApiGateway(this, pythonLambda, 'ModelMeApi');

    // Create ECS infrastructure for heavy SMPL processing (optional based on feature flag)
    const ecrRepository = createEcrRepository(this, props.stage);
    
    const ecsInfrastructure = props.env.ENABLE_ECS_HEAVY_JOBS ? createEcsCluster(
      this, 
      props.stage, 
      {
        vpc: props.vpc,
        uploadsBucket: props.uploadsBucket,
        guidanceBucket: props.guidanceBucket,
        rendersBucket: props.rendersBucket,
        smplAssetsBucket: props.smplAssetsBucket,
        ecrRepository
      }
    ) : null;

    // Create SQS queues and EventBridge bus for event-driven processing
    const { tryonQueue } = createTryonQueue(this, props.stage);
    const { billingQueue } = createBillingQueue(this, props.stage);
    const { geminiBatchQueue } = createGeminiBatchQueue(this, props.stage);

    this.tryonQueueUrl = tryonQueue.queueUrl;
    this.billingQueueUrl = billingQueue.queueUrl;

    // Create Lambda processors
    const tryonProcessor = createTryonProcessor(this, props.stage, {
      uploadsBucket: props.uploadsBucket,
      guidanceBucket: props.guidanceBucket,
      rendersBucket: props.rendersBucket,
      smplAssetsBucket: props.env.ENABLE_ECS_HEAVY_JOBS ? undefined : props.smplAssetsBucket,
    });
    
    tryonProcessor.addEventSource(new SqsEventSource(tryonQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
    
    const aiRenderProcessor = createAiRenderProcessor(this, props.stage, {
      guidanceBucket: props.guidanceBucket,
      rendersBucket: props.rendersBucket,
      allowBedrockFailover: props.env.ALLOW_BEDROCK_FAILOVER,
    });
    
    const billingProcessor = createBillingProcessor(this, props.stage);
    billingProcessor.addEventSource(new SqsEventSource(billingQueue, {
      batchSize: 5,
      reportBatchItemFailures: true,
    }));
    
    // Create EventBridge bus
    this.tryonEventBus = createTryonEventBus(
      this, 
      props.stage, 
      tryonQueue, 
      billingQueue,
      tryonProcessor,
      aiRenderProcessor,
      geminiBatchQueue
    );

    // Create budget monitoring
    createBudgetMonitoring(this, {
      stage: props.stage,
      dailyBudgetUsd: props.env.DAILY_BUDGET_USD || 50,
      alertEmail: props.env.ALERT_EMAIL || 'alerts@garmaxai.com',
    });

    // Configure IAM permissions
    pythonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [this.tryonEventBus.eventBusArn],
    }));

    // Grant Parameter Store read access to all Lambda functions
    grantReadApiKeys(props.apiKeyParameters, tryonProcessor);
    grantReadApiKeys(props.apiKeyParameters, aiRenderProcessor);
    grantReadApiKeys(props.apiKeyParameters, billingProcessor);
    grantReadApiKeys(props.apiKeyParameters, pythonLambda);

    // Configure environment variables
    this.configureEnvironmentVariables(
      pythonLambda,
      tryonProcessor,
      aiRenderProcessor,
      billingProcessor,
      props,
      ecsInfrastructure
    );

    // Outputs
    new cdk.CfnOutput(this, `ApiGatewayUrl`, {
      value: this.apiGateway.url,
      exportName: `Backend-ApiUrl-${props.stage}`,
    });

    new cdk.CfnOutput(this, `EventBridgeBusName`, {
      value: this.tryonEventBus.eventBusName,
      exportName: `Backend-EventBus-${props.stage}`,
    });

    new cdk.CfnOutput(this, `TryonQueueUrl`, {
      value: tryonQueue.queueUrl,
      exportName: `Backend-TryonQueue-${props.stage}`,
    });

    new cdk.CfnOutput(this, `BillingQueueUrl`, {
      value: billingQueue.queueUrl,
      exportName: `Backend-BillingQueue-${props.stage}`,
    });

    new cdk.CfnOutput(this, `TryonProcessorName`, {
      value: tryonProcessor.functionName,
      exportName: `Backend-TryonProcessor-${props.stage}`,
    });

    new cdk.CfnOutput(this, `AiRenderProcessorName`, {
      value: aiRenderProcessor.functionName,
      exportName: `Backend-AiRenderProcessor-${props.stage}`,
    });

    new cdk.CfnOutput(this, `BillingProcessorName`, {
      value: billingProcessor.functionName,
      exportName: `Backend-BillingProcessor-${props.stage}`,
    });

    if (props.env.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      new cdk.CfnOutput(this, `EcsClusterArn`, {
        value: ecsInfrastructure.cluster.clusterArn,
        exportName: `Backend-EcsCluster-${props.stage}`,
      });
    }
  }

  private configureEnvironmentVariables(
    pythonLambda: any,
    tryonProcessor: any,
    aiRenderProcessor: any,
    billingProcessor: any,
    props: BackendStackProps,
    ecsInfrastructure: any
  ) {
    // API Lambda environment
    pythonLambda.addEnvironment('EVENTBRIDGE_BUS_NAME', this.tryonEventBus.eventBusName);
    pythonLambda.addEnvironment('SQS_QUEUE_URL', this.tryonQueueUrl);
    pythonLambda.addEnvironment('SQS_BILLING_QUEUE_URL', this.billingQueueUrl);
    pythonLambda.addEnvironment('UPLOADS_BUCKET_NAME', props.uploadsBucket.bucketName);
    
    // Try-On Processor environment
    tryonProcessor.addEnvironment('UPLOADS_BUCKET_NAME', props.uploadsBucket.bucketName);
    tryonProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', props.guidanceBucket.bucketName);
    tryonProcessor.addEnvironment('RENDERS_BUCKET_NAME', props.rendersBucket.bucketName);
    if (!props.env.ENABLE_ECS_HEAVY_JOBS && props.smplAssetsBucket) {
      tryonProcessor.addEnvironment('SMPL_ASSETS_BUCKET_NAME', props.smplAssetsBucket.bucketName);
    }
    tryonProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
    tryonProcessor.addEnvironment('MAX_TRYONS_PER_USER_DAILY', props.env.MAX_TRYONS_PER_USER_DAILY);
    
    if (props.env.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      tryonProcessor.addEnvironment('ECS_CLUSTER_NAME', ecsInfrastructure.cluster.clusterName);
      tryonProcessor.addEnvironment('ECS_TASK_DEFINITION_ARN', ecsInfrastructure.taskDefinition.taskDefinitionArn);
      tryonProcessor.addEnvironment('ECS_SUBNET_IDS', props.vpc.privateSubnets.map((subnet: any) => subnet.subnetId).join(','));
    }
    
    // AI Render Processor environment
    aiRenderProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', props.guidanceBucket.bucketName);
    aiRenderProcessor.addEnvironment('RENDERS_BUCKET_NAME', props.rendersBucket.bucketName);
    aiRenderProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
    aiRenderProcessor.addEnvironment('RENDER_PROVIDER', props.env.RENDER_PROVIDER);
    aiRenderProcessor.addEnvironment('ALLOW_BEDROCK_FAILOVER', props.env.ALLOW_BEDROCK_FAILOVER.toString());
    aiRenderProcessor.addEnvironment('BEDROCK_MAX_FAILOVER_PER_MIN', props.env.BEDROCK_MAX_FAILOVER_PER_MIN);
    aiRenderProcessor.addEnvironment('BEDROCK_DAILY_BUDGET_USD', props.env.BEDROCK_DAILY_BUDGET_USD);
    aiRenderProcessor.addEnvironment('MAX_RENDERS_PER_USER_DAILY', props.env.MAX_RENDERS_PER_USER_DAILY);
    aiRenderProcessor.addEnvironment('ENABLE_GEMINI_BATCH', props.env.ENABLE_GEMINI_BATCH.toString());
    aiRenderProcessor.addEnvironment('GEMINI_TRAFFIC_PERCENT', props.env.GEMINI_TRAFFIC_PERCENT);
    aiRenderProcessor.addEnvironment('GEMINI_DAILY_BUDGET_USD', props.env.GEMINI_DAILY_BUDGET_USD);
    aiRenderProcessor.addEnvironment('GEMINI_MAX_BATCH_SIZE', props.env.GEMINI_MAX_BATCH_SIZE);
    aiRenderProcessor.addEnvironment('GEMINI_BATCH_TIMEOUT_MS', props.env.GEMINI_BATCH_TIMEOUT_MS);
    aiRenderProcessor.addEnvironment('GEMINI_API_ENDPOINT', props.env.GEMINI_API_ENDPOINT);
    
    // Billing Processor environment
    billingProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
  }
}

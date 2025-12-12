import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
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
import createRDS from '../RDS/createRDS';
import createCognito from '../Cognito/createCognito';
import createDBSecurityGroup from '../IAM/SecurityGroups/createDBSecurityGroup';
import createLambdaProcessorSG from '../IAM/SecurityGroups/createLambdaProcessorSG';
import type { VpcEndpointsConfig } from '../VPC/createVpcEndpoints';
import createResourceStateTable from '../DynamoDB/createResourceStateTable';
import createNATGatewayManager from '../Lambda/createNATGatewayManager';
import createTeardownOrchestrator from '../Lambda/createTeardownOrchestrator';
import createRestoreOrchestrator from '../Lambda/createRestoreOrchestrator';
import { createIdleTeardownRules } from '../EventBridge/createIdleTeardownRules';

export interface BackendStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.IVpc;
  vpcEndpoints: VpcEndpointsConfig;
  elastiCacheEndpoint: string;
  elastiCachePort: string;
  elastiCacheSecurityGroup: ec2.ISecurityGroup;
  uploadsBucket: s3.Bucket;
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  smplAssetsBucket: s3.Bucket;
  apiKeyParameters: ApiKeyParameters;
  envConfig: any; // Environment configuration (domain names, certs, etc.)
}

/**
 * BackendStack - Manages backend application infrastructure
 * - API Gateway and Lambda functions
 * - ECS cluster for SMPL processing
 * - SQS queues and EventBridge
 * - Lambda processors (try-on, AI render, billing)
 * - Budget monitoring
 */
export class BackendStack extends cdk.Stack {
  public readonly apiGateway: cdk.aws_apigateway.RestApi;
  public readonly apiDomainName?: string;
  public readonly tryonEventBus: cdk.aws_events.EventBus;
  public readonly tryonQueueUrl: string;
  public readonly billingQueueUrl: string;
  public readonly rdsCluster: rds.DatabaseCluster;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly cognitoDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Get region from CDK stack env props (passed during stack creation)
    const region = props.env?.region || 'us-east-1';

    // Create security groups for RDS
    const [rdsSecurityGroup, dynamoSecurityGroup] = createDBSecurityGroup(this, region, props.vpc);

    // Create Lambda processor security group with access to RDS, ElastiCache, and VPC endpoints
    const lambdaProcessorSG = createLambdaProcessorSG(
      this,
      props.vpc,
      rdsSecurityGroup,
      props.elastiCacheSecurityGroup,
      props.vpcEndpoints.endpointSecurityGroup
    );

    // Create Aurora MySQL database cluster
    this.rdsCluster = createRDS(this, props.stage, rdsSecurityGroup, props.vpc);

    // Create Cognito User Pool and Identity Pool
    const [userPool, userPoolClient, identityPool, cognitoDomain] = createCognito(this, props.stage);
    this.userPool = userPool as cognito.UserPool;
    this.userPoolClient = userPoolClient as cognito.UserPoolClient;
    this.identityPool = identityPool as cognito.CfnIdentityPool;
    this.cognitoDomain = cognitoDomain as cognito.UserPoolDomain;

    // Create idle teardown/restore infrastructure (enabled for all stages during beta)
    // Idle thresholds: DEV=1hr, QA=2hr, PROD=8hr
    const stateTable = createResourceStateTable(this, props.stage);

    const natGatewayManager = createNATGatewayManager(this, {
      stage: props.stage,
      vpc: props.vpc,
      stateTableName: stateTable.tableName,
    });

    // ECS infrastructure for SMPL processing
    const ecrRepository = createEcrRepository(this, props.stage);
    
    const ecsInfrastructure = props.envConfig.ENABLE_ECS_HEAVY_JOBS ? createEcsCluster(
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

    const teardownOrchestrator = createTeardownOrchestrator(this, {
      stage: props.stage,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaProcessorSG],
      rdsClusterId: this.rdsCluster.clusterIdentifier,
      elasticacheClusterId: undefined, // ElastiCache is managed in SharedInfraStack
      ecsClusterName: ecsInfrastructure?.cluster.clusterName,
      stateTableName: stateTable.tableName,
    });

    const restoreOrchestrator = createRestoreOrchestrator(this, {
      stage: props.stage,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaProcessorSG],
      stateTableName: stateTable.tableName,
    });

    // Create EventBridge rules for idle detection and activity-based restore
    createIdleTeardownRules(this, {
      stage: props.stage,
      teardownOrchestrator,
      restoreOrchestrator,
    });

    // Create API Lambda with VPC configuration
    const pythonLambda = createPythonLambda(this, 'GarmaxLambda', {
      vpc: props.vpc,
      securityGroups: [lambdaProcessorSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      redisEndpoint: props.elastiCacheEndpoint,
      redisPort: props.elastiCachePort,
    });

    // Create API Gateway (RestApi) and integrate with Lambda
    this.apiGateway = createApiGateway(this, pythonLambda, 'GarmaxApi');

    // Store API Gateway URL in SSM for frontend stack to use (avoids cross-stack exports)
    new cdk.aws_ssm.StringParameter(this, 'ApiGatewayUrlParameter', {
      parameterName: `/garmaxai/${props.stage}/api/gateway-url`,
      stringValue: this.apiGateway.url,
      description: 'API Gateway URL for frontend CloudFront distribution',
    });

    new cdk.aws_ssm.StringParameter(this, 'ApiGatewayStageNameParameter', {
      parameterName: `/garmaxai/${props.stage}/api/stage-name`,
      stringValue: this.apiGateway.deploymentStage.stageName,
      description: 'API Gateway stage name',
    });

    // Add custom domain to API Gateway if configured
    const backendDomain = (props.envConfig as any).backendDomainName || `backend.${props.envConfig.hostedZoneName}`;
    
    if (!props.envConfig.hostedZoneName.includes('PLACEHOLDER')) {
      const apiDomain = this.apiGateway.addDomainName('ApiDomain', {
        domainName: backendDomain,
        certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
          this,
          'ApiCertificate',
          (props.envConfig as any).BackendAcmCert?.[region]?.id || props.envConfig.AcmCert[region].id
        ),
      });
      this.apiDomainName = apiDomain.domainName;

      // Store custom domain in SSM for frontend stack
      new cdk.aws_ssm.StringParameter(this, 'ApiDomainNameParameter', {
        parameterName: `/garmaxai/${props.stage}/api/domain-name`,
        stringValue: apiDomain.domainName,
        description: 'API Gateway custom domain name',
      });

      // Create Route53 A Record (Alias) to point to API Gateway custom domain
      const hostedZone = route53.HostedZone.fromLookup(this, `BackendHostedZone-${props.stage}`, {
        domainName: props.envConfig.hostedZoneName,
      });

      new route53.ARecord(this, `BackendApiAliasRecord-${props.stage}`, {
        zone: hostedZone,
        recordName: backendDomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(apiDomain)
        ),
        comment: `API Gateway custom domain alias for ${props.stage} backend`,
      });

      // Output the backend URL
      new cdk.CfnOutput(this, `BackendApiUrl-${props.stage}`, {
        value: `https://${backendDomain}`,
        description: `Backend API URL (${props.stage})`,
        exportName: `Backend-CustomDomainUrl-${props.stage}`,
      });
    }

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
      smplAssetsBucket: props.envConfig.ENABLE_ECS_HEAVY_JOBS ? undefined : props.smplAssetsBucket,
      vpc: props.vpc,
      securityGroups: [lambdaProcessorSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      redisEndpoint: props.elastiCacheEndpoint,
      redisPort: props.elastiCachePort,
    });
    
    tryonProcessor.addEventSource(new SqsEventSource(tryonQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));
    
    const aiRenderProcessor = createAiRenderProcessor(this, props.stage, {
      guidanceBucket: props.guidanceBucket,
      rendersBucket: props.rendersBucket,
      allowBedrockFailover: props.envConfig.ALLOW_BEDROCK_FAILOVER,
      vpc: props.vpc,
      securityGroups: [lambdaProcessorSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      redisEndpoint: props.elastiCacheEndpoint,
      redisPort: props.elastiCachePort,
    });
    
    const billingProcessor = createBillingProcessor(this, props.stage, {
      vpc: props.vpc,
      securityGroups: [lambdaProcessorSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      redisEndpoint: props.elastiCacheEndpoint,
      redisPort: props.elastiCachePort,
    });
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
      dailyBudgetUsd: props.envConfig.DAILY_BUDGET_USD || 50,
      alertEmail: props.envConfig.ALERT_EMAIL || 'alerts@garmaxai.com',
      vpcId: props.vpc.vpcId,
    });

    // Configure IAM permissions
    pythonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [this.tryonEventBus.eventBusArn],
    }));

    // Grant RDS access to Lambda functions
    if (this.rdsCluster.secret) {
      this.rdsCluster.secret.grantRead(pythonLambda);
      this.rdsCluster.secret.grantRead(tryonProcessor);
      this.rdsCluster.secret.grantRead(aiRenderProcessor);
      this.rdsCluster.secret.grantRead(billingProcessor);
    }

    // Allow Lambda functions to connect to RDS
    this.rdsCluster.connections.allowDefaultPortFrom(pythonLambda);
    this.rdsCluster.connections.allowDefaultPortFrom(tryonProcessor);
    this.rdsCluster.connections.allowDefaultPortFrom(aiRenderProcessor);
    this.rdsCluster.connections.allowDefaultPortFrom(billingProcessor);

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

    if (props.envConfig.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      new cdk.CfnOutput(this, `EcsClusterArn`, {
        value: ecsInfrastructure.cluster.clusterArn,
        exportName: `Backend-EcsCluster-${props.stage}`,
      });
    }

    // RDS Outputs
    new cdk.CfnOutput(this, `RdsClusterEndpoint`, {
      value: this.rdsCluster.clusterEndpoint.hostname,
      exportName: `Backend-RdsEndpoint-${props.stage}`,
    });

    new cdk.CfnOutput(this, `RdsSecretArn`, {
      value: this.rdsCluster.secret?.secretArn || 'N/A',
      exportName: `Backend-RdsSecretArn-${props.stage}`,
    });

    // Cognito Outputs
    new cdk.CfnOutput(this, `UserPoolId`, {
      value: this.userPool.userPoolId,
      exportName: `Backend-UserPoolId-${props.stage}`,
    });

    new cdk.CfnOutput(this, `UserPoolClientId`, {
      value: this.userPoolClient.userPoolClientId,
      exportName: `Backend-UserPoolClientId-${props.stage}`,
    });

    new cdk.CfnOutput(this, `IdentityPoolId`, {
      value: this.identityPool.ref,
      exportName: `Backend-IdentityPoolId-${props.stage}`,
    });

    new cdk.CfnOutput(this, `CognitoDomainUrl`, {
      value: this.cognitoDomain.baseUrl(),
      exportName: `Backend-CognitoDomainUrl-${props.stage}`,
      description: 'Cognito Hosted UI domain URL for Google SSO',
    });

    // Teardown/Restore Outputs
    new cdk.CfnOutput(this, `TeardownOrchestratorArn`, {
      value: teardownOrchestrator.functionArn,
      exportName: `Backend-TeardownOrchestrator-${props.stage}`,
      description: 'Lambda function to orchestrate resource teardown during idle',
    });

    new cdk.CfnOutput(this, `RestoreOrchestratorArn`, {
      value: restoreOrchestrator.functionArn,
      exportName: `Backend-RestoreOrchestrator-${props.stage}`,
      description: 'Lambda function to orchestrate resource restoration',
    });

    new cdk.CfnOutput(this, `NATGatewayManagerArn`, {
      value: natGatewayManager.functionArn,
      exportName: `Backend-NATGatewayManager-${props.stage}`,
      description: 'Lambda function to manage NAT Gateway teardown/restore',
    });
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
    pythonLambda.addEnvironment('DATABASE_SECRET_ARN', this.rdsCluster.secret?.secretArn || '');
    pythonLambda.addEnvironment('RDS_ENDPOINT', this.rdsCluster.clusterEndpoint.hostname);
    pythonLambda.addEnvironment('COGNITO_USER_POOL_ID', this.userPool.userPoolId);
    pythonLambda.addEnvironment('COGNITO_CLIENT_ID', this.userPoolClient.userPoolClientId);
    pythonLambda.addEnvironment('COGNITO_IDENTITY_POOL_ID', this.identityPool.ref);
    pythonLambda.addEnvironment('COGNITO_DOMAIN', this.cognitoDomain.domainName);
    pythonLambda.addEnvironment('FRONTEND_URL', `https://${props.envConfig.frontendDomainName}`);
    
    // Try-On Processor environment
    tryonProcessor.addEnvironment('UPLOADS_BUCKET_NAME', props.uploadsBucket.bucketName);
    tryonProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', props.guidanceBucket.bucketName);
    tryonProcessor.addEnvironment('RENDERS_BUCKET_NAME', props.rendersBucket.bucketName);
    if (!props.envConfig.ENABLE_ECS_HEAVY_JOBS && props.smplAssetsBucket) {
      tryonProcessor.addEnvironment('SMPL_ASSETS_BUCKET_NAME', props.smplAssetsBucket.bucketName);
    }
    tryonProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
    tryonProcessor.addEnvironment('MAX_TRYONS_PER_USER_DAILY', props.envConfig.MAX_TRYONS_PER_USER_DAILY);
    
    if (props.envConfig.ENABLE_ECS_HEAVY_JOBS && ecsInfrastructure) {
      tryonProcessor.addEnvironment('ECS_CLUSTER_NAME', ecsInfrastructure.cluster.clusterName);
      tryonProcessor.addEnvironment('ECS_TASK_DEFINITION_ARN', ecsInfrastructure.taskDefinition.taskDefinitionArn);
      tryonProcessor.addEnvironment('ECS_SUBNET_IDS', props.vpc.privateSubnets.map((subnet: any) => subnet.subnetId).join(','));
    }
    
    // AI Render Processor environment
    aiRenderProcessor.addEnvironment('GUIDANCE_BUCKET_NAME', props.guidanceBucket.bucketName);
    aiRenderProcessor.addEnvironment('RENDERS_BUCKET_NAME', props.rendersBucket.bucketName);
    aiRenderProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
    aiRenderProcessor.addEnvironment('RENDER_PROVIDER', props.envConfig.RENDER_PROVIDER || 'replicate');
    aiRenderProcessor.addEnvironment('ALLOW_BEDROCK_FAILOVER', (props.envConfig.ALLOW_BEDROCK_FAILOVER ?? false).toString());
    aiRenderProcessor.addEnvironment('BEDROCK_MAX_FAILOVER_PER_MIN', props.envConfig.BEDROCK_MAX_FAILOVER_PER_MIN || '3');
    aiRenderProcessor.addEnvironment('BEDROCK_DAILY_BUDGET_USD', props.envConfig.BEDROCK_DAILY_BUDGET_USD || '50');
    aiRenderProcessor.addEnvironment('MAX_RENDERS_PER_USER_DAILY', props.envConfig.MAX_RENDERS_PER_USER_DAILY || '50');
    aiRenderProcessor.addEnvironment('ENABLE_GEMINI_BATCH', (props.envConfig.ENABLE_GEMINI_BATCH ?? false).toString());
    aiRenderProcessor.addEnvironment('GEMINI_TRAFFIC_PERCENT', props.envConfig.GEMINI_TRAFFIC_PERCENT || '0');
    aiRenderProcessor.addEnvironment('GEMINI_DAILY_BUDGET_USD', props.envConfig.GEMINI_DAILY_BUDGET_USD || '200');
    aiRenderProcessor.addEnvironment('GEMINI_MAX_BATCH_SIZE', props.envConfig.GEMINI_MAX_BATCH_SIZE || '50');
    aiRenderProcessor.addEnvironment('GEMINI_BATCH_TIMEOUT_MS', props.envConfig.GEMINI_BATCH_TIMEOUT_MS);
    aiRenderProcessor.addEnvironment('GEMINI_API_ENDPOINT', props.envConfig.GEMINI_API_ENDPOINT);
    
    // Billing Processor environment
    billingProcessor.addEnvironment('EVENT_BUS_NAME', this.tryonEventBus.eventBusName);
  }
}

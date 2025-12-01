import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Stack } from 'aws-cdk-lib';

interface CreateEcsClusterProps {
  vpc: ec2.IVpc;
  uploadsBucket: s3.Bucket;
  guidanceBucket: s3.Bucket;
  rendersBucket: s3.Bucket;
  smplAssetsBucket: s3.Bucket;
  ecrRepository: ecr.Repository;
}

/**
 * Creates ECS Fargate cluster for heavy SMPL processing workloads
 * 
 * Purpose: Handles compute-intensive SMPL estimation that exceeds Lambda limits
 * - 3D human pose recovery using ROMP
 * - Body mesh fitting with SMPLify-X  
 * - Advanced segmentation and depth estimation
 * - Multi-frame pose optimization
 * 
 * Architecture:
 * - Fargate for serverless container execution (no EC2 management)
 * - Task auto-scaling based on SQS queue depth
 * - VPC with private subnets for security
 * - CloudWatch logging for monitoring and debugging
 * 
 * Cost Optimization:
 * - Fargate Spot instances for non-critical workloads (70% savings)
 * - Auto-scaling prevents over-provisioning
 * - Tasks shut down automatically after completion
 * - CPU/memory sized appropriately for SMPL workloads (4 vCPU, 8GB RAM)
 * 
 * @param stack - CDK Stack context
 * @param stage - Deployment stage (DEV, QA, PROD)
 * @param props - Configuration including VPC, buckets, and ECR repository
 * @returns ECS Cluster and Task Definition
 */
export default function createEcsCluster(
  stack: Stack,
  stage: string,
  props: CreateEcsClusterProps,
) {
  
  const { vpc, uploadsBucket, guidanceBucket, rendersBucket, smplAssetsBucket, ecrRepository } = props;
  
  // Create ECS cluster for SMPL processing
  const cluster = new ecs.Cluster(stack, `SmplProcessingCluster-${stage}`, {
    clusterName: `GarmaxAi-SmplProcessing-${stage}`,
    vpc,
    
    // Enable container insights for monitoring
    containerInsights: true,
  });
  
  // Enable Fargate capacity providers for cost optimization
  cluster.enableFargateCapacityProviders();
  
  // Create CloudWatch log group for ECS task logs
  const logGroup = new logs.LogGroup(stack, `SmplProcessingLogs-${stage}`, {
    logGroupName: `/ecs/garmax-ai/smpl-processor/${stage.toLowerCase()}`,
    retention: stage === 'PROD' 
      ? logs.RetentionDays.SIX_MONTHS 
      : logs.RetentionDays.ONE_MONTH,
    removalPolicy: stage === 'PROD' 
      ? cdk.RemovalPolicy.RETAIN 
      : cdk.RemovalPolicy.DESTROY,
  });
  
  // Create task execution role with ECR and CloudWatch permissions
  const executionRole = new iam.Role(stack, `SmplTaskExecutionRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    description: 'Execution role for SMPL processing ECS tasks',
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
    ],
  });
  
  // Grant ECR access for pulling container images
  ecrRepository.grantPull(executionRole);
  
  // Create task role with S3 and EventBridge permissions for SMPL processing
  const taskRole = new iam.Role(stack, `SmplTaskRole-${stage}`, {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    description: 'Task role for SMPL processing with S3 and EventBridge access',
  });
  
  // Scoped S3 permissions for SMPL processing
  // READ: uploads bucket for user photos and garment references  
  uploadsBucket.grantRead(taskRole, 'avatars/*');
  uploadsBucket.grantRead(taskRole, 'garments/*');
  
  // WRITE: guidance bucket for SMPL-generated assets
  guidanceBucket.grantWrite(taskRole, 'depth/*');
  guidanceBucket.grantWrite(taskRole, 'normals/*');
  guidanceBucket.grantWrite(taskRole, 'poses/*');
  guidanceBucket.grantWrite(taskRole, 'segments/*');
  guidanceBucket.grantWrite(taskRole, 'prompts/*');
  
  // WRITE: renders bucket for preview generation
  rendersBucket.grantWrite(taskRole, 'previews/*');
  rendersBucket.grantWrite(taskRole, 'processing/*');
  
  // READ: SMPL assets bucket for ML models and weights
  smplAssetsBucket.grantRead(taskRole, 'models/*');
  smplAssetsBucket.grantRead(taskRole, 'weights/*');
  smplAssetsBucket.grantRead(taskRole, 'configs/*');
  
  // EventBridge permissions for publishing completion events
  taskRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [
        `arn:aws:events:${stack.region}:${stack.account}:event-bus/GarmaxAi-Tryon-${stage}`,
      ],
    })
  );
  
  // CloudWatch metrics for monitoring and budget tracking
  taskRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': ['GarmaxAi/SMPL', 'GarmaxAi/ECS'],
        },
      },
    })
  );
  
  // Create Fargate task definition for SMPL processing
  const taskDefinition = new ecs.FargateTaskDefinition(stack, `SmplProcessingTask-${stage}`, {
    family: `garmax-ai-smpl-processor-${stage.toLowerCase()}`,
    
    // Resource allocation for SMPL workloads
    // 4 vCPU: Required for parallel pose estimation and mesh fitting
    // 8GB RAM: Needed for loading SMPL models and processing high-res images  
    cpu: 4096, // 4 vCPU
    memoryLimitMiB: 8192, // 8GB RAM
    
    executionRole,
    taskRole,
    
    // Platform version with latest Fargate capabilities
    runtimePlatform: {
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      cpuArchitecture: ecs.CpuArchitecture.X86_64,
    },
  });
  
  // Add SMPL processing container to task definition
  const container = taskDefinition.addContainer(`smpl-processor-${stage}`, {
    containerName: 'smpl-processor',
    
    // Use ECR image (will be built and pushed separately)
    image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
    
    // Environment variables for S3 bucket access and configuration
    environment: {
      // Stage and region configuration
      STAGE: stage,
      AWS_DEFAULT_REGION: stack.region,
      
      // S3 bucket configurations for asset access
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      GUIDANCE_BUCKET: guidanceBucket.bucketName, 
      RENDERS_BUCKET: rendersBucket.bucketName,
      SMPL_ASSETS_BUCKET: smplAssetsBucket.bucketName,
      
      // EventBridge configuration for result publishing
      EVENT_BUS_NAME: `GarmaxAi-Tryon-${stage}`,
      
      // SMPL processing configuration
      SMPL_MODEL_PATH: '/app/models/smpl',
      SMPL_WEIGHTS_PATH: '/app/weights',
      ROMP_CONFIG_PATH: '/app/configs/romp.yaml',
      SMPLIFY_X_CONFIG_PATH: '/app/configs/smplify_x.yaml',
      
      // Performance tuning
      OMP_NUM_THREADS: '4', // Match vCPU allocation
      MKL_NUM_THREADS: '4',
      CUDA_VISIBLE_DEVICES: '', // CPU-only for Fargate
      
      // Processing timeouts and limits  
      MAX_PROCESSING_TIME_SECONDS: '600', // 10 minutes
      MAX_IMAGE_SIZE_MB: '50',
      BATCH_SIZE: '1', // Process one image at a time for memory efficiency
    },
    
    // Logging configuration
    logging: ecs.LogDriver.awsLogs({
      streamPrefix: 'smpl-processor',
      logGroup,
    }),
    
    // Health check for container readiness
    healthCheck: {
      command: ['CMD-SHELL', 'python -c "import torch; import cv2; print(\\"Dependencies OK\\")"'],
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      retries: 3,
      startPeriod: cdk.Duration.seconds(60), // Allow time for model loading
    },
    
    // Resource limits to prevent runaway processes
    memoryReservationMiB: 6144, // Reserve 6GB, allow burst to 8GB
    cpu: 3072, // Reserve 3 vCPU, allow burst to 4 vCPU
  });
  
  // Add CloudFormation outputs for external reference
  new cdk.CfnOutput(stack, `EcsClusterName-${stage}`, {
    value: cluster.clusterName,
    exportName: `EcsClusterName-${stage}`,
    description: 'ECS cluster name for SMPL processing',
  });
  
  new cdk.CfnOutput(stack, `EcsTaskDefinitionArn-${stage}`, {
    value: taskDefinition.taskDefinitionArn,
    exportName: `EcsTaskDefinitionArn-${stage}`,
    description: 'ECS task definition ARN for SMPL processing',
  });
  
  new cdk.CfnOutput(stack, `EcsTaskDefinitionFamily-${stage}`, {
    value: taskDefinition.family,
    exportName: `EcsTaskDefinitionFamily-${stage}`,
    description: 'ECS task definition family for SMPL processing',
  });
  
  return {
    cluster,
    taskDefinition,
    logGroup,
  };
}
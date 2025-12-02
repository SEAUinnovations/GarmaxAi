import { RDSClient, StartDBClusterCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import {
  ElastiCacheClient,
  CreateCacheClusterCommand,
  DescribeCacheClustersCommand,
} from '@aws-sdk/client-elasticache';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const rdsClient = new RDSClient({});
const elasticacheClient = new ElastiCacheClient({});
const ecsClient = new ECSClient({});
const lambdaClient = new LambdaClient({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssmClient = new SSMClient({});
const snsClient = new SNSClient({});

interface RestoreEvent {
  resource: 'rds' | 'elasticache' | 'ecs' | 'nat-gateway' | 'all';
  stage: string;
  wait?: boolean; // Whether to wait for resource to be fully available
}

/**
 * Start RDS Aurora cluster
 */
async function startRDS(stage: string, wait: boolean = false): Promise<{ status: string; endpoint?: string }> {
  // Retrieve cluster ID from Parameter Store
  const param = await ssmClient.send(
    new GetParameterCommand({
      Name: `/garmaxai/idle-state/${stage}/rds-cluster`,
    })
  ).catch(() => null);

  if (!param?.Parameter?.Value) {
    console.log('No RDS cluster to restore');
    return { status: 'not-found' };
  }

  const clusterId = param.Parameter.Value;
  console.log(`Starting RDS cluster: ${clusterId}`);

  // Check current status
  const describeResponse = await rdsClient.send(
    new DescribeDBClustersCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  const currentStatus = describeResponse.DBClusters?.[0]?.Status;
  if (currentStatus === 'available') {
    console.log(`RDS cluster already available`);
    return {
      status: 'available',
      endpoint: describeResponse.DBClusters?.[0]?.Endpoint,
    };
  }

  if (currentStatus !== 'stopped') {
    console.log(`RDS cluster in ${currentStatus} state, cannot start`);
    return { status: currentStatus || 'unknown' };
  }

  // Start the cluster
  await rdsClient.send(
    new StartDBClusterCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  // Update DynamoDB state
  await updateResourceState(`RDS_CLUSTER#${stage}`, stage, 'STARTING', {
    clusterId,
    startedAt: new Date().toISOString(),
  });

  console.log(`RDS cluster start initiated: ${clusterId}`);

  // Optionally wait for cluster to become available
  if (wait) {
    console.log('Waiting for RDS cluster to become available...');
    let attempts = 0;
    const maxAttempts = 40; // 20 minutes max

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds
      attempts++;

      const statusResponse = await rdsClient.send(
        new DescribeDBClustersCommand({
          DBClusterIdentifier: clusterId,
        })
      );

      const status = statusResponse.DBClusters?.[0]?.Status;
      if (status === 'available') {
        await updateResourceState(`RDS_CLUSTER#${stage}`, stage, 'AVAILABLE', {
          clusterId,
          availableAt: new Date().toISOString(),
        });
        return {
          status: 'available',
          endpoint: statusResponse.DBClusters?.[0]?.Endpoint,
        };
      }

      console.log(`RDS cluster status: ${status} (attempt ${attempts}/${maxAttempts})`);
    }

    throw new Error('RDS cluster did not become available within 20 minutes');
  }

  return { status: 'starting' };
}

/**
 * Restore ElastiCache cluster
 */
async function restoreElastiCache(stage: string, wait: boolean = false): Promise<{ status: string }> {
  const redisClusterId = process.env.REDIS_CLUSTER_NAME || `garmaxai-redis-${stage}`;

  // Check if cluster already exists
  const existingCluster = await elasticacheClient.send(
    new DescribeCacheClustersCommand({
      CacheClusterId: redisClusterId,
    })
  ).catch(() => null);

  if (existingCluster?.CacheClusters && existingCluster.CacheClusters.length > 0) {
    const status = existingCluster.CacheClusters[0].CacheClusterStatus;
    console.log(`ElastiCache cluster already exists with status: ${status}`);
    return { status: status || 'unknown' };
  }

  console.log(`Restoring ElastiCache cluster: ${redisClusterId}`);

  // Get configuration from environment/Parameter Store
  const subnetGroup = process.env.REDIS_SUBNET_GROUP || `garmaxai-redis-subnet-${stage}`;
  const securityGroup = process.env.REDIS_SECURITY_GROUP;

  if (stage === 'PROD') {
    // Restore from snapshot for PROD
    const snapshotParam = await ssmClient.send(
      new GetParameterCommand({
        Name: `/garmaxai/idle-state/${stage}/redis-snapshot`,
      })
    ).catch(() => null);

    if (snapshotParam?.Parameter?.Value) {
      const snapshotName = snapshotParam.Parameter.Value;
      console.log(`Restoring from snapshot: ${snapshotName}`);

      await elasticacheClient.send(
        new CreateCacheClusterCommand({
          CacheClusterId: redisClusterId,
          SnapshotName: snapshotName,
          CacheNodeType: 'cache.t4g.micro',
          Engine: 'redis',
          CacheSubnetGroupName: subnetGroup,
          SecurityGroupIds: securityGroup ? [securityGroup] : undefined,
        })
      );
    } else {
      console.log('No snapshot found for PROD, creating fresh cluster');
      await createFreshRedisCluster(redisClusterId, subnetGroup, securityGroup);
    }
  } else {
    // Create fresh cluster for DEV/QA
    console.log('Creating fresh ElastiCache cluster for DEV/QA');
    await createFreshRedisCluster(redisClusterId, subnetGroup, securityGroup);
  }

  // Update DynamoDB state
  await updateResourceState(`ELASTICACHE#${stage}`, stage, 'CREATING', {
    clusterId: redisClusterId,
    restoredAt: new Date().toISOString(),
  });

  console.log(`ElastiCache restore initiated: ${redisClusterId}`);
  return { status: 'creating' };
}

async function createFreshRedisCluster(clusterId: string, subnetGroup: string, securityGroup?: string): Promise<void> {
  await elasticacheClient.send(
    new CreateCacheClusterCommand({
      CacheClusterId: clusterId,
      CacheNodeType: 'cache.t4g.micro',
      Engine: 'redis',
      EngineVersion: '7.1',
      NumCacheNodes: 1,
      CacheSubnetGroupName: subnetGroup,
      SecurityGroupIds: securityGroup ? [securityGroup] : undefined,
    })
  );
}

/**
 * Scale up ECS services
 */
async function scaleUpECS(stage: string): Promise<{ servicesRestored: number }> {
  const ecsCluster = process.env.ECS_CLUSTER_NAME || `GarmaxAi-${stage}`;

  // Retrieve service ARNs from Parameter Store
  const param = await ssmClient.send(
    new GetParameterCommand({
      Name: `/garmaxai/idle-state/${stage}/ecs-services`,
    })
  ).catch(() => null);

  if (!param?.Parameter?.Value) {
    console.log('No ECS services to restore');
    return { servicesRestored: 0 };
  }

  const serviceArns = param.Parameter.Value.split(',');
  console.log(`Scaling up ${serviceArns.length} ECS services`);

  for (const serviceArn of serviceArns) {
    const serviceName = serviceArn.split('/').pop()!;
    console.log(`Scaling service to 1: ${serviceName}`);

    await ecsClient.send(
      new UpdateServiceCommand({
        cluster: ecsCluster,
        service: serviceName,
        desiredCount: 1,
      })
    );
  }

  // Update DynamoDB state
  await updateResourceState(`ECS_CLUSTER#${stage}`, stage, 'ACTIVE', {
    cluster: ecsCluster,
    serviceCount: serviceArns.length,
    restoredAt: new Date().toISOString(),
  });

  console.log(`Scaled up ${serviceArns.length} ECS services`);
  return { servicesRestored: serviceArns.length };
}

/**
 * Restore NAT Gateway
 */
async function restoreNATGateway(stage: string): Promise<void> {
  const functionName = process.env.NAT_MANAGER_FUNCTION_NAME || `GarmaxAi-NATManager-${stage}`;
  const vpcId = process.env.VPC_ID;

  if (!vpcId) {
    throw new Error('VPC_ID environment variable not set');
  }

  console.log(`Invoking NAT Gateway manager for VPC: ${vpcId}`);

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({
        action: 'restore',
        vpcId,
      }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  console.log(`NAT Gateway manager response:`, result);

  if (result.statusCode !== 200) {
    throw new Error(`NAT Gateway restore failed: ${result.error}`);
  }

  console.log(`NAT Gateway restore completed`);
}

/**
 * Update resource state in DynamoDB
 */
async function updateResourceState(resourceKey: string, stage: string, state: string, metadata: any): Promise<void> {
  const stateTableName = process.env.STATE_TABLE_NAME || 'GarmaxAi-ResourceState';

  await ddbClient.send(
    new PutCommand({
      TableName: stateTableName,
      Item: {
        resourceKey,
        timestamp: Date.now(),
        stage,
        currentState: state,
        metadata,
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      },
    })
  );
}

/**
 * Send restore completion notification
 */
async function sendRestoreNotification(stage: string, results: any, duration: number): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) return;

  const message = `✅ GarmaxAI ${stage} Environment Restore Completed

📊 Restore Summary:
• Duration: ${Math.floor(duration / 60)}m ${duration % 60}s
• RDS Status: ${results.rds?.status || 'N/A'}
• ElastiCache Status: ${results.elasticache?.status || 'N/A'}
• ECS Services: ${results.ecs?.servicesRestored || 0} restored
• NAT Gateway: ${results.natGateway ? 'Restored' : 'N/A'}

🚀 System is ready for production traffic!

Timestamp: ${new Date().toISOString()}`;

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `✅ GarmaxAI ${stage} - Restore Completed`,
      Message: message,
    })
  );
}

/**
 * Lambda handler
 */
export const handler = async (event: RestoreEvent): Promise<any> => {
  console.log('Restore orchestrator invoked:', JSON.stringify(event, null, 2));
  const startTime = Date.now();

  try {
    const { resource, stage, wait = false } = event;

    let results: any = {};

    switch (resource) {
      case 'rds':
        results.rds = await startRDS(stage, wait);
        break;

      case 'elasticache':
        results.elasticache = await restoreElastiCache(stage, wait);
        break;

      case 'ecs':
        results.ecs = await scaleUpECS(stage);
        break;

      case 'nat-gateway':
        await restoreNATGateway(stage);
        results.natGateway = true;
        break;

      case 'all':
        // Execute all restores in parallel
        const [rdsResult, elasticacheResult, ecsResult] = await Promise.all([
          startRDS(stage, wait),
          restoreElastiCache(stage, wait),
          scaleUpECS(stage),
          restoreNATGateway(stage),
        ]);

        results = {
          rds: rdsResult,
          elasticache: elasticacheResult,
          ecs: ecsResult,
          natGateway: true,
        };
        break;

      default:
        throw new Error(`Unknown resource: ${resource}`);
    }

    // Clean up idle state parameters
    const paramsToDelete = [
      `/garmaxai/idle-state/${stage}/timestamp`,
      `/garmaxai/idle-state/${stage}/rds-cluster`,
      `/garmaxai/idle-state/${stage}/redis-snapshot`,
      `/garmaxai/idle-state/${stage}/ecs-services`,
    ];

    for (const paramName of paramsToDelete) {
      await ssmClient.send(new DeleteParameterCommand({ Name: paramName })).catch(() => {});
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    await sendRestoreNotification(stage, results, duration);

    return {
      statusCode: 200,
      message: `Restore completed for ${resource} in ${stage}`,
      results,
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Restore orchestrator error:', error);
    throw error;
  }
};

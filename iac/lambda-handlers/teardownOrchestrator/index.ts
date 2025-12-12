import { RDSClient, StopDBClusterCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import {
  ElastiCacheClient,
  CreateSnapshotCommand,
  DeleteCacheClusterCommand,
  DescribeCacheClustersCommand,
} from '@aws-sdk/client-elasticache';
import { ECSClient, UpdateServiceCommand, ListServicesCommand } from '@aws-sdk/client-ecs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

const rdsClient = new RDSClient({});
const elasticacheClient = new ElastiCacheClient({});
const ecsClient = new ECSClient({});
const lambdaClient = new LambdaClient({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssmClient = new SSMClient({});

interface TeardownEvent {
  resource: 'rds' | 'elasticache' | 'ecs' | 'nat-gateway' | 'all';
  stage: string;
  vpcId?: string;
  clusterId?: string;
  redisClusterId?: string;
  ecsCluster?: string;
}

/**
 * Stop RDS Aurora cluster
 */
async function stopRDS(stage: string, clusterId: string): Promise<void> {
  console.log(`Stopping RDS cluster: ${clusterId}`);

  // Check current status
  const describeResponse = await rdsClient.send(
    new DescribeDBClustersCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  const status = describeResponse.DBClusters?.[0]?.Status;
  if (status === 'stopped') {
    console.log(`RDS cluster already stopped`);
    return;
  }

  if (status !== 'available') {
    throw new Error(`Cannot stop RDS cluster in status: ${status}`);
  }

  // Stop the cluster
  await rdsClient.send(
    new StopDBClusterCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  // Store cluster ID in Parameter Store
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/garmaxai/idle-state/${stage}/rds-cluster`,
      Value: clusterId,
      Type: 'String',
      Overwrite: true,
    })
  );

  // Update DynamoDB state
  await updateResourceState(`RDS_CLUSTER#${stage}`, stage, 'STOPPING', {
    clusterId,
    stoppedAt: new Date().toISOString(),
  });

  console.log(`RDS cluster stop initiated: ${clusterId}`);
}

/**
 * Snapshot and delete ElastiCache cluster
 */
async function teardownElastiCache(stage: string, redisClusterId: string): Promise<void> {
  console.log(`Tearing down ElastiCache cluster: ${redisClusterId}`);

  // Check if cluster exists
  const describeResponse = await elasticacheClient.send(
    new DescribeCacheClustersCommand({
      CacheClusterId: redisClusterId,
    })
  ).catch(() => null);

  if (!describeResponse || !describeResponse.CacheClusters || describeResponse.CacheClusters.length === 0) {
    console.log(`ElastiCache cluster not found, skipping`);
    return;
  }

  const clusterStatus = describeResponse.CacheClusters[0].CacheClusterStatus;
  if (clusterStatus !== 'available') {
    console.log(`ElastiCache cluster not available (status: ${clusterStatus}), skipping`);
    return;
  }

  // Create snapshot for PROD before deletion
  if (stage === 'PROD') {
    const snapshotName = `garmaxai-redis-${stage}-idle-${Date.now()}`;
    console.log(`Creating snapshot: ${snapshotName}`);

    await elasticacheClient.send(
      new CreateSnapshotCommand({
        CacheClusterId: redisClusterId,
        SnapshotName: snapshotName,
      })
    );

    // Store snapshot name in Parameter Store
    await ssmClient.send(
      new PutParameterCommand({
        Name: `/garmaxai/idle-state/${stage}/redis-snapshot`,
        Value: snapshotName,
        Type: 'String',
        Overwrite: true,
      })
    );

    // Wait a few seconds for snapshot to initialize
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Delete the cluster
  await elasticacheClient.send(
    new DeleteCacheClusterCommand({
      CacheClusterId: redisClusterId,
    })
  );

  // Update DynamoDB state
  await updateResourceState(`ELASTICACHE#${stage}`, stage, 'DELETING', {
    clusterId: redisClusterId,
    deletedAt: new Date().toISOString(),
    snapshotCreated: stage === 'PROD',
  });

  console.log(`ElastiCache cluster deletion initiated: ${redisClusterId}`);
}

/**
 * Scale down ECS services
 */
async function scaleDownECS(stage: string, ecsCluster: string): Promise<void> {
  console.log(`Scaling down ECS services in cluster: ${ecsCluster}`);

  // List all services
  const listResponse = await ecsClient.send(
    new ListServicesCommand({
      cluster: ecsCluster,
    })
  );

  if (!listResponse.serviceArns || listResponse.serviceArns.length === 0) {
    console.log(`No ECS services found in cluster`);
    return;
  }

  // Store service ARNs for restore
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/garmaxai/idle-state/${stage}/ecs-services`,
      Value: listResponse.serviceArns.join(','),
      Type: 'StringList',
      Overwrite: true,
    })
  );

  // Scale each service to 0
  for (const serviceArn of listResponse.serviceArns) {
    const serviceName = serviceArn.split('/').pop()!;
    console.log(`Scaling service to 0: ${serviceName}`);

    await ecsClient.send(
      new UpdateServiceCommand({
        cluster: ecsCluster,
        service: serviceName,
        desiredCount: 0,
      })
    );
  }

  // Update DynamoDB state
  await updateResourceState(`ECS_CLUSTER#${stage}`, stage, 'SCALED_DOWN', {
    cluster: ecsCluster,
    serviceCount: listResponse.serviceArns.length,
    scaledDownAt: new Date().toISOString(),
  });

  console.log(`Scaled down ${listResponse.serviceArns.length} ECS services`);
}

/**
 * Invoke NAT Gateway manager for teardown
 */
async function teardownNATGateway(stage: string, vpcId: string): Promise<void> {
  console.log(`Invoking NAT Gateway manager for VPC: ${vpcId}`);

  const functionName = process.env.NAT_MANAGER_FUNCTION_NAME || `GarmaxAi-NATManager-${stage}`;

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({
        action: 'teardown',
        vpcId,
      }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  console.log(`NAT Gateway manager response:`, result);

  if (result.statusCode !== 200) {
    throw new Error(`NAT Gateway teardown failed: ${result.error}`);
  }

  console.log(`NAT Gateway teardown completed`);
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
 * Lambda handler
 */
export const handler = async (event: TeardownEvent): Promise<any> => {
  console.log('Teardown orchestrator invoked:', JSON.stringify(event, null, 2));

  try {
    const { resource, stage } = event;

    // Record teardown start time
    await ssmClient.send(
      new PutParameterCommand({
        Name: `/garmaxai/idle-state/${stage}/timestamp`,
        Value: new Date().toISOString(),
        Type: 'String',
        Overwrite: true,
      })
    );

    switch (resource) {
      case 'rds':
        if (!event.clusterId) throw new Error('clusterId required for RDS teardown');
        await stopRDS(stage, event.clusterId);
        break;

      case 'elasticache':
        if (!event.redisClusterId) throw new Error('redisClusterId required for ElastiCache teardown');
        await teardownElastiCache(stage, event.redisClusterId);
        break;

      case 'ecs':
        if (!event.ecsCluster) throw new Error('ecsCluster required for ECS teardown');
        await scaleDownECS(stage, event.ecsCluster);
        break;

      case 'nat-gateway':
        if (!event.vpcId) throw new Error('vpcId required for NAT Gateway teardown');
        // Skip NAT Gateway teardown for PROD to maintain API connectivity
        if (stage.toLowerCase() === 'prod') {
          console.log(`Skipping NAT Gateway teardown for PROD environment`);
        } else {
          await teardownNATGateway(stage, event.vpcId);
        }
        break;

      case 'all':
        // Execute all teardowns in parallel for efficiency
        // Note: NAT Gateway is skipped for PROD to maintain API connectivity
        await Promise.all([
          event.clusterId ? stopRDS(stage, event.clusterId) : Promise.resolve(),
          event.redisClusterId ? teardownElastiCache(stage, event.redisClusterId) : Promise.resolve(),
          event.ecsCluster ? scaleDownECS(stage, event.ecsCluster) : Promise.resolve(),
          event.vpcId && stage.toLowerCase() !== 'prod' ? teardownNATGateway(stage, event.vpcId) : Promise.resolve(),
        ]);
        break;

      default:
        throw new Error(`Unknown resource: ${resource}`);
    }

    return {
      statusCode: 200,
      message: `Teardown completed for ${resource} in ${stage}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Teardown orchestrator error:', error);
    throw error;
  }
};

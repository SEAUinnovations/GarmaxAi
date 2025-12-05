import * as cdk from 'aws-cdk-lib';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ElastiCacheConfig {
  endpoint: string;
  port: string;
  cluster?: elasticache.CfnCacheCluster;
  replicationGroup?: elasticache.CfnReplicationGroup;
}

export function createElastiCache(
  scope: Construct,
  stage: string,
  vpc: ec2.IVpc,
  securityGroup: ec2.ISecurityGroup
): ElastiCacheConfig {
  // Subnet group for ElastiCache in private subnets
  const subnetGroup = new elasticache.CfnSubnetGroup(
    scope,
    `RedisSubnetGroup-${stage}`,
    {
      description: `GarmaxAI Redis subnet group for ${stage}`,
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
      cacheSubnetGroupName: `garmaxai-redis-subnet-group-${stage.toLowerCase()}`,
    }
  );

  // Parameter group with optimized settings
  const parameterGroup = new elasticache.CfnParameterGroup(
    scope,
    `RedisParameterGroup-${stage}`,
    {
      cacheParameterGroupFamily: 'redis7',
      description: `GarmaxAI Redis parameters for ${stage}`,
      properties: {
        'maxmemory-policy': 'allkeys-lru',
        'timeout': '300',
        'tcp-keepalive': '300',
      },
    }
  );

  // Stage-specific snapshot configuration
  const snapshotRetentionLimit = stage === 'PROD' ? 7 : 0;
  const snapshotWindow = stage === 'PROD' ? '03:00-04:00' : undefined;
  const preferredMaintenanceWindow = 'sun:05:00-sun:06:00';

  // PROD uses Multi-AZ replication group for high availability
  // DEV/QA uses single-node cluster for cost savings
  if (stage === 'PROD') {
    // Multi-AZ replication group with automatic failover
    const replicationGroup = new elasticache.CfnReplicationGroup(
      scope,
      `RedisReplicationGroup-${stage}`,
      {
        replicationGroupId: `garmaxai-redis-${stage.toLowerCase()}`,
        replicationGroupDescription: `GarmaxAI Redis replication group for ${stage} with automatic failover`,
        cacheNodeType: 'cache.t4g.micro', // Smallest ARM-based instance
        engine: 'redis',
        engineVersion: '7.1',
        numCacheClusters: 2, // Primary + 1 replica for automatic failover
        automaticFailoverEnabled: true,
        multiAzEnabled: true,
        cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
        securityGroupIds: [securityGroup.securityGroupId],
        cacheParameterGroupName: parameterGroup.ref,
        preferredMaintenanceWindow,
        snapshotRetentionLimit,
        snapshotWindow,
        autoMinorVersionUpgrade: true,
        port: 6379,
        atRestEncryptionEnabled: true,
        transitEncryptionEnabled: false, // Disabled for compatibility with clients
        tags: [
          { key: 'Environment', value: stage },
          { key: 'CostCenter', value: 'Infrastructure' },
          { key: 'Purpose', value: 'SessionCache' },
          { key: 'HighAvailability', value: 'true' },
        ],
      }
    );

    replicationGroup.addDependency(subnetGroup);

    // Outputs for reference
    new cdk.CfnOutput(scope, `RedisEndpoint-${stage}`, {
      value: replicationGroup.attrPrimaryEndPointAddress,
      description: `Redis primary endpoint for ${stage}`,
      exportName: `GarmaxAI-RedisEndpoint-${stage}`,
    });

    new cdk.CfnOutput(scope, `RedisPort-${stage}`, {
      value: replicationGroup.attrPrimaryEndPointPort,
      description: `Redis port for ${stage}`,
      exportName: `GarmaxAI-RedisPort-${stage}`,
    });

    new cdk.CfnOutput(scope, `RedisReplicationGroupId-${stage}`, {
      value: replicationGroup.replicationGroupId || `garmaxai-redis-${stage.toLowerCase()}`,
      description: `Redis replication group ID for ${stage}`,
      exportName: `GarmaxAI-RedisReplicationGroupId-${stage}`,
    });

    return {
      endpoint: replicationGroup.attrPrimaryEndPointAddress,
      port: replicationGroup.attrPrimaryEndPointPort,
      replicationGroup,
    };
  } else {
    // Single-node cluster for DEV/QA
    const cacheCluster = new elasticache.CfnCacheCluster(
      scope,
      `RedisCluster-${stage}`,
      {
        cacheNodeType: 'cache.t4g.micro', // Smallest ARM-based instance
        engine: 'redis',
        engineVersion: '7.1',
        numCacheNodes: 1,
        clusterName: `garmaxai-redis-${stage.toLowerCase()}`,
        cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
        vpcSecurityGroupIds: [securityGroup.securityGroupId],
        cacheParameterGroupName: parameterGroup.ref,
        preferredMaintenanceWindow,
        snapshotRetentionLimit,
        ...(snapshotWindow && { snapshotWindow }),
        autoMinorVersionUpgrade: true,
        port: 6379,
        tags: [
          { key: 'Environment', value: stage },
          { key: 'CostCenter', value: 'Infrastructure' },
          { key: 'AutoShutdown', value: 'true' },
          { key: 'Purpose', value: 'SessionCache' },
        ],
      }
    );

    cacheCluster.addDependency(subnetGroup);

    // Outputs for reference
    new cdk.CfnOutput(scope, `RedisEndpoint-${stage}`, {
      value: cacheCluster.attrRedisEndpointAddress,
      description: `Redis endpoint for ${stage}`,
      exportName: `GarmaxAI-RedisEndpoint-${stage}`,
    });

    new cdk.CfnOutput(scope, `RedisPort-${stage}`, {
      value: cacheCluster.attrRedisEndpointPort,
      description: `Redis port for ${stage}`,
      exportName: `GarmaxAI-RedisPort-${stage}`,
    });

    new cdk.CfnOutput(scope, `RedisClusterName-${stage}`, {
      value: cacheCluster.clusterName || `garmaxai-redis-${stage.toLowerCase()}`,
      description: `Redis cluster name for ${stage}`,
      exportName: `GarmaxAI-RedisClusterName-${stage}`,
    });

    return {
      endpoint: cacheCluster.attrRedisEndpointAddress,
      port: cacheCluster.attrRedisEndpointPort,
      cluster: cacheCluster,
    };
  }
}

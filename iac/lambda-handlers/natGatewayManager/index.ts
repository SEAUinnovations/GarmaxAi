import {
  EC2Client,
  DescribeNatGatewaysCommand,
  DeleteNatGatewayCommand,
  CreateNatGatewayCommand,
  DescribeRouteTablesCommand,
  DeleteRouteCommand,
  CreateRouteCommand,
  NatGateway,
  RouteTable,
} from '@aws-sdk/client-ec2';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ec2Client = new EC2Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const STAGE = process.env.STAGE || 'DEV';
const STATE_TABLE = process.env.STATE_TABLE || `garmaxai-resource-states-${STAGE}`;

interface NATGatewayConfig {
  natGatewayId: string;
  allocationId: string;
  subnetId: string;
}

interface RouteConfig {
  routeTableId: string;
  destinationCidrBlock: string;
  natGatewayId: string;
}

enum ResourceState {
  ACTIVE = 'ACTIVE',
  TEARDOWN_INITIATED = 'TEARDOWN_INITIATED',
  NAT_DELETING = 'NAT_DELETING',
  NAT_DELETED = 'NAT_DELETED',
  ROUTES_UPDATING = 'ROUTES_UPDATING',
  IDLE = 'IDLE',
  RESTORE_INITIATED = 'RESTORE_INITIATED',
  NAT_CREATING = 'NAT_CREATING',
  NAT_AVAILABLE = 'NAT_AVAILABLE',
  ROUTES_RESTORING = 'ROUTES_RESTORING',
}

export const handler = async (event: any): Promise<any> => {
  console.log('NAT Gateway Manager invoked:', JSON.stringify(event, null, 2));

  const action = event.action; // 'teardown' or 'restore'
  const vpcId = event.vpcId || process.env.VPC_ID;

  if (!vpcId) {
    throw new Error('VPC ID is required');
  }

  try {
    if (action === 'teardown') {
      return await teardownNATGateways(vpcId);
    } else if (action === 'restore') {
      return await restoreNATGateways(vpcId);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('NAT Gateway Manager error:', error);
    await updateState(ResourceState.IDLE, ResourceState.IDLE, { error: String(error) });
    throw error;
  }
};

async function teardownNATGateways(vpcId: string): Promise<any> {
  console.log(`Starting NAT Gateway teardown for VPC: ${vpcId}`);

  // Check if already in teardown or idle state
  const currentState = await getCurrentState();
  if (currentState === ResourceState.IDLE || currentState === ResourceState.NAT_DELETING) {
    console.log(`Already in state: ${currentState}, skipping teardown`);
    return { status: 'already_idle', currentState };
  }

  await updateState(ResourceState.ACTIVE, ResourceState.TEARDOWN_INITIATED, {
    vpcId,
    timestamp: new Date().toISOString(),
  });

  // 1. Describe and save NAT Gateway configurations
  const natGateways = await describeNATGateways(vpcId);
  console.log(`Found ${natGateways.length} NAT Gateways`);

  if (natGateways.length === 0) {
    console.log('No NAT Gateways found, marking as IDLE');
    await updateState(ResourceState.TEARDOWN_INITIATED, ResourceState.IDLE, {});
    return { status: 'no_nat_gateways' };
  }

  const natConfigs: NATGatewayConfig[] = natGateways.map((ng) => ({
    natGatewayId: ng.NatGatewayId!,
    allocationId: ng.NatGatewayAddresses?.[0]?.AllocationId || '',
    subnetId: ng.SubnetId!,
  }));

  // Save NAT Gateway configurations to Parameter Store
  await saveNATGatewayConfig(natConfigs);

  // 2. Get route tables before deleting NAT Gateways
  const routeConfigs = await getRoutesPointingToNAT(vpcId, natGateways.map((ng) => ng.NatGatewayId!));
  console.log(`Found ${routeConfigs.length} routes pointing to NAT Gateways`);

  // Save route configurations to DynamoDB for restore
  await updateState(ResourceState.TEARDOWN_INITIATED, ResourceState.NAT_DELETING, {
    natGateways: natConfigs,
    routes: routeConfigs,
  });

  // 3. Delete NAT Gateways
  for (const natConfig of natConfigs) {
    console.log(`Deleting NAT Gateway: ${natConfig.natGatewayId}`);
    await ec2Client.send(
      new DeleteNatGatewayCommand({
        NatGatewayId: natConfig.natGatewayId,
      })
    );
  }

  // 4. Poll for deletion completion
  await pollNATGatewayDeletion(natGateways.map((ng) => ng.NatGatewayId!));

  await updateState(ResourceState.NAT_DELETING, ResourceState.NAT_DELETED, {});

  // 5. Remove routes (they should be automatically removed, but clean up if needed)
  console.log('Updating route tables...');
  await updateState(ResourceState.NAT_DELETED, ResourceState.ROUTES_UPDATING, {});

  for (const routeConfig of routeConfigs) {
    try {
      console.log(`Removing route: ${routeConfig.destinationCidrBlock} from ${routeConfig.routeTableId}`);
      await ec2Client.send(
        new DeleteRouteCommand({
          RouteTableId: routeConfig.routeTableId,
          DestinationCidrBlock: routeConfig.destinationCidrBlock,
        })
      );
    } catch (error: any) {
      // Route might already be deleted automatically
      console.log(`Route deletion skipped (might be auto-deleted): ${error.message}`);
    }
  }

  await updateState(ResourceState.ROUTES_UPDATING, ResourceState.IDLE, {
    teardownCompleted: new Date().toISOString(),
  });

  console.log('NAT Gateway teardown completed successfully');
  return {
    status: 'success',
    natGatewaysDeleted: natConfigs.length,
    routesRemoved: routeConfigs.length,
    elasticIPsPreserved: natConfigs.map((c) => c.allocationId),
  };
}

async function restoreNATGateways(vpcId: string): Promise<any> {
  console.log(`Starting NAT Gateway restore for VPC: ${vpcId}`);

  // Check current state
  const currentState = await getCurrentState();
  if (currentState === ResourceState.ACTIVE) {
    console.log('Already ACTIVE, skipping restore');
    return { status: 'already_active' };
  }

  if (currentState !== ResourceState.IDLE) {
    throw new Error(`Cannot restore from state: ${currentState}`);
  }

  await updateState(ResourceState.IDLE, ResourceState.RESTORE_INITIATED, {
    timestamp: new Date().toISOString(),
  });

  // 1. Retrieve saved configurations
  const natConfigs = await getNATGatewayConfig();
  const stateData = await getStateData();

  if (!natConfigs || natConfigs.length === 0) {
    throw new Error('No NAT Gateway configurations found in Parameter Store');
  }

  console.log(`Restoring ${natConfigs.length} NAT Gateways`);

  await updateState(ResourceState.RESTORE_INITIATED, ResourceState.NAT_CREATING, {});

  // 2. Recreate NAT Gateways
  const newNATGateways: { [oldId: string]: string } = {};

  for (const natConfig of natConfigs) {
    console.log(`Creating NAT Gateway in subnet: ${natConfig.subnetId}`);
    const result = await ec2Client.send(
      new CreateNatGatewayCommand({
        SubnetId: natConfig.subnetId,
        AllocationId: natConfig.allocationId, // Reuse the preserved Elastic IP
        TagSpecifications: [
          {
            ResourceType: 'natgateway',
            Tags: [
              { Key: 'Name', Value: `garmaxai-nat-${STAGE}` },
              { Key: 'Environment', Value: STAGE },
              { Key: 'ManagedBy', Value: 'IdleManager' },
              { Key: 'RestoredAt', Value: new Date().toISOString() },
            ],
          },
        ],
      })
    );

    newNATGateways[natConfig.natGatewayId] = result.NatGateway!.NatGatewayId!;
    console.log(`Created new NAT Gateway: ${result.NatGateway!.NatGatewayId}`);
  }

  // 3. Wait for NAT Gateways to become available
  await pollNATGatewayAvailability(Object.values(newNATGateways));

  await updateState(ResourceState.NAT_CREATING, ResourceState.NAT_AVAILABLE, {
    newNATGateways,
  });

  // 4. Restore routes
  console.log('Restoring routes...');
  await updateState(ResourceState.NAT_AVAILABLE, ResourceState.ROUTES_RESTORING, {});

  const routeConfigs: RouteConfig[] = stateData?.routes || [];

  for (const routeConfig of routeConfigs) {
    const newNATGatewayId = newNATGateways[routeConfig.natGatewayId];
    if (!newNATGatewayId) {
      console.warn(`No new NAT Gateway ID found for old ID: ${routeConfig.natGatewayId}`);
      continue;
    }

    try {
      console.log(
        `Creating route: ${routeConfig.destinationCidrBlock} -> ${newNATGatewayId} in ${routeConfig.routeTableId}`
      );
      await ec2Client.send(
        new CreateRouteCommand({
          RouteTableId: routeConfig.routeTableId,
          DestinationCidrBlock: routeConfig.destinationCidrBlock,
          NatGatewayId: newNATGatewayId,
        })
      );
    } catch (error: any) {
      console.error(`Failed to create route: ${error.message}`);
      // Continue with other routes even if one fails
    }
  }

  await updateState(ResourceState.ROUTES_RESTORING, ResourceState.ACTIVE, {
    restoreCompleted: new Date().toISOString(),
    natGateways: Object.values(newNATGateways),
  });

  console.log('NAT Gateway restore completed successfully');
  return {
    status: 'success',
    natGatewaysCreated: Object.keys(newNATGateways).length,
    routesRestored: routeConfigs.length,
    newNATGateways,
  };
}

// Helper functions

async function describeNATGateways(vpcId: string): Promise<NatGateway[]> {
  const result = await ec2Client.send(
    new DescribeNatGatewaysCommand({
      Filter: [
        { Name: 'vpc-id', Values: [vpcId] },
        { Name: 'state', Values: ['available'] },
      ],
    })
  );
  return result.NatGateways || [];
}

async function getRoutesPointingToNAT(vpcId: string, natGatewayIds: string[]): Promise<RouteConfig[]> {
  const result = await ec2Client.send(
    new DescribeRouteTablesCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }],
    })
  );

  const routeConfigs: RouteConfig[] = [];

  for (const routeTable of result.RouteTables || []) {
    for (const route of routeTable.Routes || []) {
      if (route.NatGatewayId && natGatewayIds.includes(route.NatGatewayId)) {
        routeConfigs.push({
          routeTableId: routeTable.RouteTableId!,
          destinationCidrBlock: route.DestinationCidrBlock!,
          natGatewayId: route.NatGatewayId,
        });
      }
    }
  }

  return routeConfigs;
}

async function pollNATGatewayDeletion(natGatewayIds: string[]): Promise<void> {
  const maxAttempts = 20; // 10 minutes (30 seconds * 20)
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await ec2Client.send(
      new DescribeNatGatewaysCommand({
        NatGatewayIds: natGatewayIds,
      })
    );

    const allDeleted = result.NatGateways?.every((ng) => ng.State === 'deleted') ?? false;

    if (allDeleted) {
      console.log('All NAT Gateways deleted successfully');
      return;
    }

    console.log(`Waiting for NAT Gateways to delete... (attempt ${attempts + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds
    attempts++;
  }

  throw new Error('Timeout waiting for NAT Gateway deletion');
}

async function pollNATGatewayAvailability(natGatewayIds: string[]): Promise<void> {
  const maxAttempts = 20;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await ec2Client.send(
      new DescribeNatGatewaysCommand({
        NatGatewayIds: natGatewayIds,
      })
    );

    const allAvailable = result.NatGateways?.every((ng) => ng.State === 'available') ?? false;

    if (allAvailable) {
      console.log('All NAT Gateways are now available');
      return;
    }

    console.log(`Waiting for NAT Gateways to become available... (attempt ${attempts + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    attempts++;
  }

  throw new Error('Timeout waiting for NAT Gateway availability');
}

async function saveNATGatewayConfig(configs: NATGatewayConfig[]): Promise<void> {
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/garmaxai/nat-gateway/${STAGE}/config`,
      Value: JSON.stringify(configs),
      Type: 'String',
      Overwrite: true,
      Description: `NAT Gateway configurations for ${STAGE} idle restore`,
    })
  );

  // Also save EIP allocation IDs separately for easy reference
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/garmaxai/nat-gateway/${STAGE}/eip-alloc-ids`,
      Value: configs.map((c) => c.allocationId).join(','),
      Type: 'StringList',
      Overwrite: true,
      Description: `Elastic IP allocation IDs for ${STAGE}`,
    })
  );
}

async function getNATGatewayConfig(): Promise<NATGatewayConfig[]> {
  try {
    const result = await ssmClient.send(
      new GetParameterCommand({
        Name: `/garmaxai/nat-gateway/${STAGE}/config`,
      })
    );
    return JSON.parse(result.Parameter!.Value!);
  } catch (error) {
    console.error('Failed to retrieve NAT Gateway config:', error);
    return [];
  }
}

async function updateState(previousState: ResourceState, newState: ResourceState, metadata: any): Promise<void> {
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  await dynamoClient.send(
    new PutCommand({
      TableName: STATE_TABLE,
      Item: {
        resourceKey: `NAT_GATEWAY#${STAGE}`,
        timestamp,
        state: newState,
        previousState,
        stage: STAGE,
        metadata,
        ttl,
      },
    })
  );

  console.log(`State updated: ${previousState} -> ${newState}`);
}

async function getCurrentState(): Promise<ResourceState> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: STATE_TABLE,
      KeyConditionExpression: 'resourceKey = :key',
      ExpressionAttributeValues: {
        ':key': `NAT_GATEWAY#${STAGE}`,
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1,
    })
  );

  if (result.Items && result.Items.length > 0) {
    return result.Items[0].state as ResourceState;
  }

  return ResourceState.ACTIVE; // Default state
}

async function getStateData(): Promise<any> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: STATE_TABLE,
      KeyConditionExpression: 'resourceKey = :key',
      ExpressionAttributeValues: {
        ':key': `NAT_GATEWAY#${STAGE}`,
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  if (result.Items && result.Items.length > 0) {
    return result.Items[0].metadata || {};
  }

  return {};
}

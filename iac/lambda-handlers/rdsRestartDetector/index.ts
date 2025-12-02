import { RDSClient, StopDBClusterCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const rdsClient = new RDSClient({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const snsClient = new SNSClient({});
const ssmClient = new SSMClient({});

interface CloudTrailEvent {
  version: string;
  id: string;
  'detail-type': string;
  source: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    eventVersion: string;
    eventID: string;
    eventTime: string;
    eventName: string;
    awsRegion: string;
    sourceIPAddress: string;
    userAgent: string;
    requestParameters: {
      dBClusterIdentifier?: string;
    };
    responseElements: {
      dBClusterIdentifier?: string;
      status?: string;
    };
    eventType: string;
  };
}

/**
 * Check if environment is in idle state
 */
async function isEnvironmentIdle(stage: string, clusterId: string): Promise<boolean> {
  const stateTableName = process.env.STATE_TABLE_NAME || 'GarmaxAi-ResourceState';
  
  try {
    // Query DynamoDB for RDS cluster state
    const response = await ddbClient.send(
      new QueryCommand({
        TableName: stateTableName,
        KeyConditionExpression: 'resourceKey = :key',
        ExpressionAttributeValues: {
          ':key': `RDS_CLUSTER#${stage}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1,
      })
    );

    if (!response.Items || response.Items.length === 0) {
      console.log(`No state record found for RDS cluster in ${stage}`);
      return false;
    }

    const state = response.Items[0];
    console.log(`Current RDS state: ${state.currentState}`);

    // Consider idle if state is STOPPING, STOPPED, or IDLE
    return ['STOPPING', 'STOPPED', 'IDLE'].includes(state.currentState);
  } catch (error) {
    console.error('Error checking environment state:', error);
    return false;
  }
}

/**
 * Check if this is a user-initiated start or auto-restart
 */
async function isAutoRestart(detail: CloudTrailEvent['detail']): Promise<boolean> {
  // Auto-restart happens exactly 7 days after stop
  // Check for automatic service account or internal AWS user agent
  const userAgent = detail.userAgent || '';
  const sourceIP = detail.sourceIPAddress || '';

  // AWS internal restarts typically come from:
  // - Service account (aws-internal)
  // - Scheduled maintenance
  // - No user identity (automated process)
  
  if (userAgent.includes('aws-internal') || sourceIP === 'AWS Internal') {
    console.log('Auto-restart detected: AWS internal service');
    return true;
  }

  // If there's no user identity or it's a service account, likely auto-restart
  if (detail.eventType === 'AwsServiceEvent') {
    console.log('Auto-restart detected: AWS service event');
    return true;
  }

  return false;
}

/**
 * Re-stop the RDS cluster
 */
async function restopCluster(clusterId: string, stage: string): Promise<void> {
  console.log(`Re-stopping RDS cluster: ${clusterId}`);

  // Verify cluster is actually running
  const describeResponse = await rdsClient.send(
    new DescribeDBClustersCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  const status = describeResponse.DBClusters?.[0]?.Status;
  console.log(`Current cluster status: ${status}`);

  if (status !== 'available') {
    console.log(`Cluster not in available state (${status}), skipping re-stop`);
    return;
  }

  // Stop the cluster
  await rdsClient.send(
    new StopDBClusterCommand({
      DBClusterIdentifier: clusterId,
    })
  );

  console.log(`RDS cluster re-stop command issued successfully`);

  // Update DynamoDB state
  const stateTableName = process.env.STATE_TABLE_NAME || 'GarmaxAi-ResourceState';
  await ddbClient.send(
    new PutCommand({
      TableName: stateTableName,
      Item: {
        resourceKey: `RDS_CLUSTER#${stage}`,
        timestamp: Date.now(),
        stage,
        currentState: 'STOPPING',
        metadata: {
          clusterId,
          reason: 'auto-restart-detected',
          reStoppedAt: new Date().toISOString(),
          autoRestartCount: 1,
        },
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
      },
    })
  );
}

/**
 * Send notification about auto-restart
 */
async function sendNotification(
  clusterId: string,
  stage: string,
  action: 'detected' | 'restoped' | 'ignored'
): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) {
    console.log('SNS topic ARN not configured, skipping notification');
    return;
  }

  let subject: string;
  let message: string;

  switch (action) {
    case 'detected':
      subject = `⚠️ ${stage} RDS Auto-Restart Detected`;
      message = `⚠️ GarmaxAI ${stage} RDS Auto-Restart Detected

AWS automatically restarted the RDS cluster after 7 days of being stopped.

Cluster: ${clusterId}
Stage: ${stage}
Event: StartDBCluster (auto-restart after 7 days)
Time: ${new Date().toISOString()}

The system is evaluating whether to re-stop the cluster based on idle state.`;
      break;

    case 'restoped':
      subject = `🔄 ${stage} RDS Auto-Restarted and Re-Stopped`;
      message = `🔄 GarmaxAI ${stage} RDS Auto-Restart Handled

AWS automatically restarted the RDS cluster after 7 days. The system has automatically re-stopped it.

Cluster: ${clusterId}
Stage: ${stage}
Reason: Environment is still in idle state
Action: Cluster re-stopped automatically
Time: ${new Date().toISOString()}

💰 Cost Impact:
• Prevented: ~$0.0833/hour ($60/month if allowed to run)
• The cluster was running for <5 minutes before being re-stopped

📊 Note:
This will happen every 7 days while the environment remains idle. Consider using the restore workflow if the environment needs to be active.

ℹ️ AWS Limitation:
RDS clusters automatically restart after 7 days stopped. This is an AWS service limitation, not a system issue.`;
      break;

    case 'ignored':
      subject = `ℹ️ ${stage} RDS Auto-Restart Ignored`;
      message = `ℹ️ GarmaxAI ${stage} RDS Auto-Restart (No Action)

AWS automatically restarted the RDS cluster, but the system detected this is a user-initiated restore operation.

Cluster: ${clusterId}
Stage: ${stage}
Action: No action taken (user activity detected)
Time: ${new Date().toISOString()}

The cluster will remain running as this appears to be part of an environment restore.`;
      break;
  }

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
    })
  );

  console.log(`Notification sent: ${action}`);
}

/**
 * Lambda handler for RDS auto-restart detection
 */
export const handler = async (event: CloudTrailEvent): Promise<void> => {
  console.log('RDS restart detector invoked:', JSON.stringify(event, null, 2));

  try {
    const { detail } = event;

    // Verify this is a StartDBCluster event
    if (detail.eventName !== 'StartDBCluster') {
      console.log(`Ignoring non-StartDBCluster event: ${detail.eventName}`);
      return;
    }

    const clusterId =
      detail.requestParameters?.dBClusterIdentifier || detail.responseElements?.dBClusterIdentifier;

    if (!clusterId) {
      console.log('No cluster identifier found in event');
      return;
    }

    console.log(`Processing StartDBCluster event for: ${clusterId}`);

    // Extract stage from cluster ID (assumes naming convention: garmaxai-{stage}-*)
    const stageMatch = clusterId.match(/garmaxai-(\w+)/i);
    const stage = stageMatch ? stageMatch[1].toUpperCase() : 'UNKNOWN';

    if (stage === 'UNKNOWN') {
      console.log(`Cannot determine stage from cluster ID: ${clusterId}`);
      return;
    }

    // Check if this is an auto-restart
    const isAuto = await isAutoRestart(detail);
    
    if (!isAuto) {
      console.log('User-initiated start detected, no action needed');
      await sendNotification(clusterId, stage, 'ignored');
      return;
    }

    // Send detection notification
    await sendNotification(clusterId, stage, 'detected');

    // Check if environment is in idle state
    const isIdle = await isEnvironmentIdle(stage, clusterId);

    if (!isIdle) {
      console.log('Environment not in idle state, allowing cluster to start');
      await sendNotification(clusterId, stage, 'ignored');
      return;
    }

    // Environment is idle and cluster auto-restarted - re-stop it
    console.log('Environment is idle, re-stopping cluster...');
    
    // Wait a few seconds to ensure cluster is fully started
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await restopCluster(clusterId, stage);
    await sendNotification(clusterId, stage, 'restoped');

    console.log('RDS auto-restart handling completed successfully');
  } catch (error) {
    console.error('Error handling RDS auto-restart:', error);
    
    // Send error notification
    const topicArn = process.env.SNS_TOPIC_ARN;
    if (topicArn) {
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: '❌ RDS Auto-Restart Handler Error',
          Message: `Error handling RDS auto-restart:\n\n${error}\n\nEvent: ${JSON.stringify(event, null, 2)}`,
        })
      ).catch(console.error);
    }

    throw error;
  }
};

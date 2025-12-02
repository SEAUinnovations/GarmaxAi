import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const snsClient = new SNSClient({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssmClient = new SSMClient({});

interface ApprovalEvent {
  action: 'request' | 'approve' | 'deny';
  stage: string;
  executionArn?: string;
  token?: string;
  approvalId?: string;
}

interface ApprovalRecord {
  approvalId: string;
  stage: string;
  executionArn: string;
  requestedAt: string;
  estimatedSavings: number;
  idleHours: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  token: string;
}

/**
 * Generate approval email with cost breakdown and action links
 */
async function sendApprovalRequest(
  stage: string,
  executionArn: string,
  token: string,
  approvalId: string
): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) {
    throw new Error('SNS_TOPIC_ARN environment variable not set');
  }

  // Query DynamoDB for current resource states to estimate savings
  const stateTableName = process.env.STATE_TABLE_NAME || 'GarmaxAi-ResourceState';
  const queryResponse = await ddbClient.send(
    new QueryCommand({
      TableName: stateTableName,
      IndexName: 'StageIndex',
      KeyConditionExpression: 'stage = :stage',
      ExpressionAttributeValues: {
        ':stage': stage,
      },
      Limit: 10,
    })
  );

  // Calculate idle hours from last activity
  const lastActivityParam = await ssmClient.send(
    new GetParameterCommand({
      Name: `/garmaxai/metrics/${stage}/last-activity`,
    })
  ).catch(() => null);

  const lastActivity = lastActivityParam?.Parameter?.Value
    ? new Date(lastActivityParam.Parameter.Value)
    : new Date(Date.now() - 25 * 60 * 60 * 1000); // Default to 25 hours ago if not found

  const idleHours = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60));
  const estimatedSavings = idleHours * 0.2902; // $0.2902/hour

  // Store approval request in DynamoDB
  await ddbClient.send(
    new UpdateCommand({
      TableName: process.env.APPROVAL_TABLE_NAME || 'GarmaxAi-Approvals',
      Key: { approvalId },
      UpdateExpression:
        'SET stage = :stage, executionArn = :arn, requestedAt = :time, estimatedSavings = :savings, idleHours = :hours, #status = :status, #token = :token, expiresAt = :expires',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#token': 'token',
      },
      ExpressionAttributeValues: {
        ':stage': stage,
        ':arn': executionArn,
        ':time': new Date().toISOString(),
        ':savings': estimatedSavings,
        ':hours': idleHours,
        ':status': 'pending',
        ':token': token,
        ':expires': Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
      },
    })
  );

  // Generate approval/deny URLs (these would point to API Gateway endpoints)
  const apiBaseUrl = process.env.API_BASE_URL || 'https://api.garmaxai.com';
  const approveUrl = `${apiBaseUrl}/approval/approve?id=${approvalId}&token=${token}`;
  const denyUrl = `${apiBaseUrl}/approval/deny?id=${approvalId}&token=${token}`;

  const message = `🚨 GarmaxAI ${stage} Idle Teardown Approval Required

📊 Idle Detection Summary:
• Environment: ${stage}
• Idle Duration: ${idleHours} hours
• Estimated Savings: $${estimatedSavings.toFixed(2)}
• Last Activity: ${lastActivity.toISOString()}

💰 Expected Cost Reduction (per hour idle):
• RDS Aurora: $0.0833/hr
• ElastiCache: $0.0181/hr
• NAT Gateway: $0.0444/hr
• ECS Fargate: $0.0417/hr
• Lambda Reserved: $0.0008/hr
• EventBridge: $0.0100/hr
━━━━━━━━━━━━━━━━━━━━━━━━
• Total Savings: $0.2902/hr ($209.40/month if idle 24/7)

🔧 Resources to be Stopped:
${queryResponse.Items?.map((item) => `• ${item.resourceKey}: ${item.currentState}`).join('\n') || '• (Fetching resource list...)'}

⏱️ Approval Window:
This request will expire in 2 hours. If not approved by then:
• DEV/QA: Will auto-approve and proceed with teardown
• PROD: Will be rescheduled for next idle detection window

✅ APPROVE TEARDOWN:
${approveUrl}

❌ DENY TEARDOWN:
${denyUrl}

⚠️ PROD Teardown Impact:
• RDS Aurora will be stopped (auto-restarts after 7 days)
• ElastiCache snapshot will be created before deletion
• NAT Gateway Elastic IPs will be preserved
• All resources can be restored in ~10-15 minutes

📧 Questions? Reply to this email or contact DevOps.

Execution ARN: ${executionArn}
Approval ID: ${approvalId}
Timestamp: ${new Date().toISOString()}`;

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `🚨 Approval Required: ${stage} Idle Teardown ($${estimatedSavings.toFixed(2)} savings)`,
      Message: message,
    })
  );

  console.log(`Approval request sent for ${stage} environment. Approval ID: ${approvalId}`);
}

/**
 * Process approval decision
 */
async function processApproval(approvalId: string, approved: boolean): Promise<{ approved: boolean; executionArn: string }> {
  const approvalTableName = process.env.APPROVAL_TABLE_NAME || 'GarmaxAi-Approvals';

  // Retrieve approval record
  const record = await ddbClient.send(
    new QueryCommand({
      TableName: approvalTableName,
      KeyConditionExpression: 'approvalId = :id',
      ExpressionAttributeValues: {
        ':id': approvalId,
      },
    })
  );

  if (!record.Items || record.Items.length === 0) {
    throw new Error(`Approval record not found: ${approvalId}`);
  }

  const approval = record.Items[0] as ApprovalRecord;

  // Check if already processed or expired
  if (approval.status !== 'pending') {
    throw new Error(`Approval already ${approval.status}`);
  }

  if (Date.now() > parseInt(approval.expiresAt as unknown as string)) {
    await ddbClient.send(
      new UpdateCommand({
        TableName: approvalTableName,
        Key: { approvalId },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'expired' },
      })
    );
    throw new Error('Approval request has expired');
  }

  // Update approval status
  await ddbClient.send(
    new UpdateCommand({
      TableName: approvalTableName,
      Key: { approvalId },
      UpdateExpression: 'SET #status = :status, processedAt = :time',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': approved ? 'approved' : 'denied',
        ':time': new Date().toISOString(),
      },
    })
  );

  // Send confirmation notification
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (topicArn) {
    await snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `${approved ? '✅ Approved' : '❌ Denied'}: ${approval.stage} Idle Teardown`,
        Message: `The idle teardown request for ${approval.stage} has been ${approved ? 'APPROVED' : 'DENIED'}.

Approval ID: ${approvalId}
Stage: ${approval.stage}
Idle Hours: ${approval.idleHours}
Estimated Savings: $${approval.estimatedSavings.toFixed(2)}
Decision Time: ${new Date().toISOString()}

${approved ? '🔄 Teardown will proceed automatically.' : '🛑 Teardown has been cancelled. Resources will remain active.'}`,
      })
    );
  }

  return {
    approved,
    executionArn: approval.executionArn,
  };
}

/**
 * Lambda handler
 */
export const handler = async (event: ApprovalEvent): Promise<any> => {
  console.log('Approval handler invoked:', JSON.stringify(event, null, 2));

  try {
    switch (event.action) {
      case 'request': {
        const approvalId = `approval-${event.stage}-${Date.now()}`;
        const token = Math.random().toString(36).substring(2, 15);

        await sendApprovalRequest(event.stage, event.executionArn!, token, approvalId);

        return {
          statusCode: 200,
          approvalId,
          token,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        };
      }

      case 'approve':
      case 'deny': {
        const result = await processApproval(event.approvalId!, event.action === 'approve');

        return {
          statusCode: 200,
          approved: result.approved,
          executionArn: result.executionArn,
        };
      }

      default:
        throw new Error(`Unknown action: ${event.action}`);
    }
  } catch (error) {
    console.error('Approval handler error:', error);
    throw error;
  }
};

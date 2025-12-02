import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const snsClient = new SNSClient({});
const cloudwatchClient = new CloudWatchClient({});

interface CostEvent {
  reportType: 'daily' | 'monthly' | 'on-demand';
  stage?: string;
  startDate?: string;
  endDate?: string;
}

interface ResourceState {
  resourceKey: string;
  timestamp: number;
  stage: string;
  currentState: string;
  metadata: any;
}

interface CostBreakdown {
  rds: { hours: number; cost: number };
  elasticache: { hours: number; cost: number };
  natGateway: { hours: number; cost: number };
  ecs: { hours: number; cost: number };
  lambda: { hours: number; cost: number };
  eventBridge: { hours: number; cost: number };
  total: { hours: number; cost: number };
}

const HOURLY_RATES = {
  rds: 0.0833, // $60/month ÷ 720 hours
  elasticache: 0.0181, // $13/month ÷ 720 hours
  natGateway: 0.0444, // $32/month ÷ 720 hours
  ecs: 0.0417, // $30/month ÷ 720 hours
  lambda: 0.0008, // $6/month ÷ 720 hours
  eventBridge: 0.0100, // $72/month ÷ 720 hours (when active)
  total: 0.2902, // Combined rate
};

/**
 * Calculate idle hours for a resource based on state transitions
 */
function calculateIdleHours(states: ResourceState[]): number {
  if (states.length === 0) return 0;

  let totalIdleMs = 0;
  let lastIdleStart: number | null = null;

  // Sort states by timestamp
  const sortedStates = states.sort((a, b) => a.timestamp - b.timestamp);

  for (const state of sortedStates) {
    const isIdleState = ['STOPPING', 'STOPPED', 'IDLE', 'SCALED_DOWN', 'DELETED'].includes(state.currentState);

    if (isIdleState && lastIdleStart === null) {
      // Entering idle state
      lastIdleStart = state.timestamp;
    } else if (!isIdleState && lastIdleStart !== null) {
      // Exiting idle state
      totalIdleMs += state.timestamp - lastIdleStart;
      lastIdleStart = null;
    }
  }

  // If still in idle state, count up to now
  if (lastIdleStart !== null) {
    totalIdleMs += Date.now() - lastIdleStart;
  }

  return totalIdleMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Query DynamoDB for resource states in a date range
 */
async function getResourceStates(
  stage: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, ResourceState[]>> {
  const stateTableName = process.env.STATE_TABLE_NAME || 'GarmaxAi-ResourceState';
  const resourceStates = new Map<string, ResourceState[]>();

  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();

  // Query by stage index
  const response = await ddbClient.send(
    new QueryCommand({
      TableName: stateTableName,
      IndexName: 'StageIndex',
      KeyConditionExpression: 'stage = :stage',
      FilterExpression: '#timestamp BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':stage': stage,
        ':start': startTimestamp,
        ':end': endTimestamp,
      },
    })
  );

  // Group states by resource type
  for (const item of response.Items || []) {
    const state = item as ResourceState;
    const resourceType = state.resourceKey.split('#')[0]; // e.g., "RDS_CLUSTER", "ELASTICACHE"

    if (!resourceStates.has(resourceType)) {
      resourceStates.set(resourceType, []);
    }
    resourceStates.get(resourceType)!.push(state);
  }

  return resourceStates;
}

/**
 * Calculate cost savings for a stage
 */
async function calculateCostSavings(
  stage: string,
  startDate: Date,
  endDate: Date
): Promise<CostBreakdown> {
  const resourceStates = await getResourceStates(stage, startDate, endDate);

  const breakdown: CostBreakdown = {
    rds: { hours: 0, cost: 0 },
    elasticache: { hours: 0, cost: 0 },
    natGateway: { hours: 0, cost: 0 },
    ecs: { hours: 0, cost: 0 },
    lambda: { hours: 0, cost: 0 },
    eventBridge: { hours: 0, cost: 0 },
    total: { hours: 0, cost: 0 },
  };

  // Calculate idle hours for each resource type
  const rdsStates = resourceStates.get('RDS_CLUSTER') || [];
  breakdown.rds.hours = calculateIdleHours(rdsStates);
  breakdown.rds.cost = breakdown.rds.hours * HOURLY_RATES.rds;

  const elasticacheStates = resourceStates.get('ELASTICACHE') || [];
  breakdown.elasticache.hours = calculateIdleHours(elasticacheStates);
  breakdown.elasticache.cost = breakdown.elasticache.hours * HOURLY_RATES.elasticache;

  const natStates = resourceStates.get('NAT_GATEWAY') || [];
  breakdown.natGateway.hours = calculateIdleHours(natStates);
  breakdown.natGateway.cost = breakdown.natGateway.hours * HOURLY_RATES.natGateway;

  const ecsStates = resourceStates.get('ECS_CLUSTER') || [];
  breakdown.ecs.hours = calculateIdleHours(ecsStates);
  breakdown.ecs.cost = breakdown.ecs.hours * HOURLY_RATES.ecs;

  // Lambda and EventBridge savings are approximate
  const maxIdleHours = Math.max(
    breakdown.rds.hours,
    breakdown.elasticache.hours,
    breakdown.natGateway.hours,
    breakdown.ecs.hours
  );
  breakdown.lambda.hours = maxIdleHours;
  breakdown.lambda.cost = maxIdleHours * HOURLY_RATES.lambda;

  breakdown.eventBridge.hours = maxIdleHours;
  breakdown.eventBridge.cost = maxIdleHours * HOURLY_RATES.eventBridge;

  // Calculate total
  breakdown.total.hours = maxIdleHours;
  breakdown.total.cost = Object.values(breakdown)
    .filter((item) => item !== breakdown.total)
    .reduce((sum, item) => sum + item.cost, 0);

  return breakdown;
}

/**
 * Generate daily cost report
 */
async function generateDailyReport(stage: string): Promise<any> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const breakdown = await calculateCostSavings(stage, today, tomorrow);

  return {
    reportType: 'daily',
    stage,
    date: today.toISOString().split('T')[0],
    breakdown,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate monthly cost report
 */
async function generateMonthlyReport(stage: string): Promise<any> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const breakdown = await calculateCostSavings(stage, firstDay, lastDay);

  // Calculate projected monthly savings
  const daysInMonth = lastDay.getDate();
  const daysElapsed = now.getDate();
  const projectedTotal = (breakdown.total.cost / daysElapsed) * daysInMonth;

  return {
    reportType: 'monthly',
    stage,
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    daysElapsed,
    daysInMonth,
    breakdown,
    projected: {
      total: projectedTotal,
      annualized: projectedTotal * 12,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Upload report to S3
 */
async function uploadReportToS3(report: any): Promise<string> {
  const bucketName = process.env.COST_REPORTS_BUCKET || 'garmaxai-cost-reports';
  const { reportType, stage, date, month } = report;

  let key: string;
  if (reportType === 'daily') {
    const [year, monthStr, day] = date.split('-');
    key = `${stage}/${year}/${monthStr}/${day}.json`;
  } else {
    const [year, monthStr] = month.split('-');
    key = `${stage}/${year}/${monthStr}/summary.json`;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
      Metadata: {
        stage,
        reportType,
        generatedAt: report.generatedAt,
      },
    })
  );

  return `s3://${bucketName}/${key}`;
}

/**
 * Send monthly summary email
 */
async function sendMonthlySummary(report: any): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) return;

  const { stage, month, breakdown, projected } = report;

  const message = `📊 GarmaxAI ${stage} Monthly Cost Savings Report

Month: ${month}
Report Generated: ${new Date().toISOString()}

💰 Cost Savings Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• RDS Aurora:      ${breakdown.rds.hours.toFixed(1)}h → $${breakdown.rds.cost.toFixed(2)}
• ElastiCache:     ${breakdown.elasticache.hours.toFixed(1)}h → $${breakdown.elasticache.cost.toFixed(2)}
• NAT Gateway:     ${breakdown.natGateway.hours.toFixed(1)}h → $${breakdown.natGateway.cost.toFixed(2)}
• ECS Fargate:     ${breakdown.ecs.hours.toFixed(1)}h → $${breakdown.ecs.cost.toFixed(2)}
• Lambda Reserved: ${breakdown.lambda.hours.toFixed(1)}h → $${breakdown.lambda.cost.toFixed(2)}
• EventBridge:     ${breakdown.eventBridge.hours.toFixed(1)}h → $${breakdown.eventBridge.cost.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Savings:   ${breakdown.total.hours.toFixed(1)}h → $${breakdown.total.cost.toFixed(2)}

📈 Projections:
• Projected Month Total:  $${projected.total.toFixed(2)}
• Annualized Savings:     $${projected.annualized.toFixed(2)}/year

📊 Efficiency Metrics:
• Idle Percentage: ${((breakdown.total.hours / (24 * 30)) * 100).toFixed(1)}%
• Average Daily Savings: $${(breakdown.total.cost / report.daysElapsed).toFixed(2)}

💡 Insights:
${breakdown.total.hours > 500 ? '⚠️  High idle time detected - consider right-sizing or consolidating environments' : '✅ Idle time within expected ranges'}
${breakdown.total.cost > 150 ? '🎉 Excellent cost optimization! Significant savings achieved.' : '📊 Moderate savings - review idle detection thresholds if needed'}

📁 Detailed report available in S3 cost reports bucket
`;

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `📊 ${stage} Monthly Cost Report: $${breakdown.total.cost.toFixed(2)} Saved`,
      Message: message,
    })
  );
}

/**
 * Publish metrics to CloudWatch
 */
async function publishMetrics(stage: string, breakdown: CostBreakdown): Promise<void> {
  const namespace = 'GarmaxAI/CostOptimization';

  await cloudwatchClient.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: 'IdleHours',
          Value: breakdown.total.hours,
          Unit: 'Count',
          Dimensions: [{ Name: 'Stage', Value: stage }],
          Timestamp: new Date(),
        },
        {
          MetricName: 'CostSavings',
          Value: breakdown.total.cost,
          Unit: 'None',
          Dimensions: [{ Name: 'Stage', Value: stage }],
          Timestamp: new Date(),
        },
        {
          MetricName: 'RDSIdleHours',
          Value: breakdown.rds.hours,
          Unit: 'Count',
          Dimensions: [{ Name: 'Stage', Value: stage }],
          Timestamp: new Date(),
        },
        {
          MetricName: 'ElastiCacheIdleHours',
          Value: breakdown.elasticache.hours,
          Unit: 'Count',
          Dimensions: [{ Name: 'Stage', Value: stage }],
          Timestamp: new Date(),
        },
        {
          MetricName: 'NATGatewayIdleHours',
          Value: breakdown.natGateway.hours,
          Unit: 'Count',
          Dimensions: [{ Name: 'Stage', Value: stage }],
          Timestamp: new Date(),
        },
      ],
    })
  );
}

/**
 * Lambda handler
 */
export const handler = async (event: CostEvent): Promise<any> => {
  console.log('Cost reporter invoked:', JSON.stringify(event, null, 2));

  try {
    const { reportType, stage = 'DEV' } = event;

    let report: any;

    switch (reportType) {
      case 'daily':
        report = await generateDailyReport(stage);
        break;

      case 'monthly':
        report = await generateMonthlyReport(stage);
        break;

      case 'on-demand':
        const startDate = event.startDate ? new Date(event.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = event.endDate ? new Date(event.endDate) : new Date();
        const breakdown = await calculateCostSavings(stage, startDate, endDate);
        report = {
          reportType: 'on-demand',
          stage,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          breakdown,
          generatedAt: new Date().toISOString(),
        };
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    // Upload to S3
    const s3Location = await uploadReportToS3(report);
    console.log(`Report uploaded to: ${s3Location}`);

    // Publish metrics to CloudWatch
    await publishMetrics(stage, report.breakdown);

    // Send monthly summary email
    if (reportType === 'monthly') {
      await sendMonthlySummary(report);
    }

    return {
      statusCode: 200,
      message: `${reportType} cost report generated successfully`,
      s3Location,
      totalSavings: report.breakdown.total.cost,
      report,
    };
  } catch (error) {
    console.error('Cost reporter error:', error);
    throw error;
  }
};

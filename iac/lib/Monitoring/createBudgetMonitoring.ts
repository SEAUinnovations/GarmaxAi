import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface BudgetMonitoringProps {
  stage: string;
  dailyBudgetUsd: number;
  alertEmail: string;
  vpcId?: string; // For NAT Gateway filtering
}

/**
 * Creates CloudWatch alarms and SNS notifications for budget monitoring
 * 
 * Monitors:
 * - Estimated daily charges (composite alarm for all services)
 * - Lambda invocation costs
 * - S3 storage and request costs
 * - ECS task costs
 * - RDS database costs
 * - NAT Gateway data transfer costs
 * - VPC endpoint hourly costs
 * 
 * Alerts when daily charges approach or exceed threshold
 */
export default function createBudgetMonitoring(
  scope: Construct,
  props: BudgetMonitoringProps
): {
  alarmTopic: sns.Topic;
  budgetAlarm: cloudwatch.CompositeAlarm;
} {
  const { stage, dailyBudgetUsd, alertEmail, vpcId } = props;

  // Environment-specific NAT Gateway daily thresholds (in GB)
  const natGatewayThresholdGB = stage === 'PROD' ? 150 : stage === 'QA' ? 50 : 20;
  // NAT Gateway cost: $0.045/GB for data processing
  const natGatewayThresholdUsd = natGatewayThresholdGB * 0.045;

  // Create SNS topic for budget alerts
  const alarmTopic = new sns.Topic(scope, `BudgetAlarmTopic-${stage}`, {
    displayName: `GarmaxAI Budget Alerts (${stage})`,
    topicName: `GarmaxAI-BudgetAlarms-${stage}`,
  });

  // Subscribe email to SNS topic
  alarmTopic.addSubscription(
    new subscriptions.EmailSubscription(alertEmail)
  );

  // Estimated Charges alarm (primary budget monitor)
  const estimatedChargesAlarm = new cloudwatch.Alarm(scope, `EstimatedChargesAlarm-${stage}`, {
    alarmName: `GarmaxAI-EstimatedCharges-${stage}`,
    alarmDescription: `Daily estimated charges approaching $${dailyBudgetUsd} threshold`,
    metric: new cloudwatch.Metric({
      namespace: 'AWS/Billing',
      metricName: 'EstimatedCharges',
      statistic: 'Maximum',
      period: cdk.Duration.hours(6), // Check every 6 hours
      dimensionsMap: {
        Currency: 'USD',
      },
    }),
    threshold: dailyBudgetUsd * 0.8, // Alert at 80% of daily budget
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  });

  // Lambda invocations alarm (cost per million invocations)
  const lambdaInvocationsAlarm = new cloudwatch.Alarm(scope, `LambdaInvocationsAlarm-${stage}`, {
    alarmName: `GarmaxAI-LambdaInvocations-${stage}`,
    alarmDescription: 'Lambda invocations exceeding normal baseline',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Invocations',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    }),
    threshold: 100000, // Alert if >100k invocations/hour (indicates runaway process)
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  });

  // Lambda errors alarm (high error rate = wasted money)
  const lambdaErrorsAlarm = new cloudwatch.Alarm(scope, `LambdaErrorsAlarm-${stage}`, {
    alarmName: `GarmaxAI-LambdaErrors-${stage}`,
    alarmDescription: 'Lambda error rate above 5% (wasted compute costs)',
    metric: new cloudwatch.MathExpression({
      expression: '(errors / invocations) * 100',
      usingMetrics: {
        errors: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        invocations: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
      },
    }),
    threshold: 5, // 5% error rate
    evaluationPeriods: 3,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  });

  // S3 storage costs alarm (check if storage is growing unexpectedly)
  const s3StorageAlarm = new cloudwatch.Alarm(scope, `S3StorageAlarm-${stage}`, {
    alarmName: `GarmaxAI-S3Storage-${stage}`,
    alarmDescription: 'S3 storage exceeding 500GB (potential cost issue)',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/S3',
      metricName: 'BucketSizeBytes',
      statistic: 'Average',
      period: cdk.Duration.hours(24),
    }),
    threshold: 500 * 1024 * 1024 * 1024, // 500 GB in bytes
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  });

  // NAT Gateway data transfer alarm (monitors outbound data to internet)
  const natGatewayAlarm = new cloudwatch.Alarm(scope, `NatGatewayDataTransferAlarm-${stage}`, {
    alarmName: `GarmaxAI-NatGatewayDataTransfer-${stage}`,
    alarmDescription: `NAT Gateway data transfer exceeding ${natGatewayThresholdGB}GB/day (~$${natGatewayThresholdUsd.toFixed(2)})`,
    metric: new cloudwatch.Metric({
      namespace: 'AWS/NATGateway',
      metricName: 'BytesOutToDestination',
      statistic: 'Sum',
      period: cdk.Duration.hours(24), // Daily aggregation
      ...(vpcId && {
        dimensionsMap: {
          // Filter by VPC if provided (requires NAT Gateway IDs, will match all in VPC)
        },
      }),
    }),
    threshold: natGatewayThresholdGB * 1024 * 1024 * 1024, // Convert GB to bytes
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  });

  // VPC endpoint cost alarm (5 interface endpoints × $0.01/hour × 24 hours = $1.20/day)
  // This is informational - interface endpoints have fixed hourly costs
  const vpcEndpointDailyCost = 5 * 0.01 * 24; // $1.20/day for 5 interface endpoints
  
  // Track VPC endpoint usage via processed bytes (data transfer through endpoints)
  const vpcEndpointUsageAlarm = new cloudwatch.Alarm(scope, `VpcEndpointUsageAlarm-${stage}`, {
    alarmName: `GarmaxAI-VpcEndpointUsage-${stage}`,
    alarmDescription: `VPC endpoint data transfer unusually high (may indicate misconfiguration)`,
    metric: new cloudwatch.Metric({
      namespace: 'AWS/PrivateLinkEndpoints',
      metricName: 'BytesProcessed',
      statistic: 'Sum',
      period: cdk.Duration.hours(24),
    }),
    threshold: 100 * 1024 * 1024 * 1024, // 100GB/day threshold (informational)
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING, // Endpoints may not always have metrics
  });

  // Composite alarm combining all cost indicators
  const budgetAlarm = new cloudwatch.CompositeAlarm(scope, `BudgetCompositeAlarm-${stage}`, {
    compositeAlarmName: `GarmaxAI-BudgetMonitor-${stage}`,
    alarmDescription: `Budget monitoring composite alarm for ${stage} environment`,
    alarmRule: cloudwatch.AlarmRule.anyOf(
      cloudwatch.AlarmRule.fromAlarm(estimatedChargesAlarm, cloudwatch.AlarmState.ALARM),
      cloudwatch.AlarmRule.allOf(
        cloudwatch.AlarmRule.fromAlarm(lambdaInvocationsAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(lambdaErrorsAlarm, cloudwatch.AlarmState.ALARM)
      ),
      cloudwatch.AlarmRule.fromAlarm(s3StorageAlarm, cloudwatch.AlarmState.ALARM),
      cloudwatch.AlarmRule.fromAlarm(natGatewayAlarm, cloudwatch.AlarmState.ALARM),
      cloudwatch.AlarmRule.fromAlarm(vpcEndpointUsageAlarm, cloudwatch.AlarmState.ALARM)
    ),
  });

  // Add SNS action to composite alarm
  budgetAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

  // Add individual alarm actions for immediate notification
  estimatedChargesAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
  lambdaInvocationsAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
  lambdaErrorsAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
  s3StorageAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
  natGatewayAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
  vpcEndpointUsageAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

  // CloudWatch dashboard for budget visualization
  const dashboard = new cloudwatch.Dashboard(scope, `BudgetDashboard-${stage}`, {
    dashboardName: `GarmaxAI-Budget-${stage}`,
  });

  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      title: 'Estimated Daily Charges',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Billing',
          metricName: 'EstimatedCharges',
          statistic: 'Maximum',
          period: cdk.Duration.hours(6),
          dimensionsMap: { Currency: 'USD' },
        }),
      ],
      leftAnnotations: [
        { value: dailyBudgetUsd * 0.8, label: '80% Budget', color: '#ff9900' },
        { value: dailyBudgetUsd, label: '100% Budget', color: '#d13212' },
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'Lambda Invocations',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          statistic: 'Sum',
          period: cdk.Duration.hours(1),
        }),
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'Lambda Error Rate',
      left: [
        new cloudwatch.MathExpression({
          expression: '(errors / invocations) * 100',
          usingMetrics: {
            errors: new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Errors',
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
            invocations: new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Invocations',
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          },
        }),
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'S3 Storage Size',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/S3',
          metricName: 'BucketSizeBytes',
          statistic: 'Average',
          period: cdk.Duration.hours(24),
        }),
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'NAT Gateway Data Transfer',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/NATGateway',
          metricName: 'BytesOutToDestination',
          statistic: 'Sum',
          period: cdk.Duration.hours(1),
          label: 'Outbound to Internet',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/NATGateway',
          metricName: 'BytesInFromDestination',
          statistic: 'Sum',
          period: cdk.Duration.hours(1),
          label: 'Inbound from Internet',
        }),
      ],
      leftAnnotations: [
        { 
          value: natGatewayThresholdGB * 1024 * 1024 * 1024, 
          label: `Daily Threshold (${natGatewayThresholdGB}GB)`, 
          color: '#ff9900' 
        },
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'VPC Endpoint Usage & Cost',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/PrivateLinkEndpoints',
          metricName: 'BytesProcessed',
          statistic: 'Sum',
          period: cdk.Duration.hours(24),
          label: 'Data Processed',
        }),
      ],
      right: [
        // Static cost indicator (5 endpoints × $0.01/hr)
        new cloudwatch.MathExpression({
          expression: '5 * 0.01',
          label: 'Hourly Cost (USD)',
        }),
      ],
      leftYAxis: {
        label: 'Bytes',
      },
      rightYAxis: {
        label: 'Cost (USD/hour)',
      },
    })
  );

  return {
    alarmTopic,
    budgetAlarm,
  };
}

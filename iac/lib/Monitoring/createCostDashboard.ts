import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

interface CostDashboardProps {
  stage: string;
  teardownStateMachine?: sfn.IStateMachine;
  restoreStateMachine?: sfn.IStateMachine;
}

/**
 * CloudWatch dashboard for cost optimization metrics
 */
export function createCostDashboard(scope: Construct, props: CostDashboardProps): cloudwatch.Dashboard {
  const { stage } = props;

  const dashboard = new cloudwatch.Dashboard(scope, `CostOptimizationDashboard-${stage}`, {
    dashboardName: `GarmaxAI-CostOptimization-${stage}`,
    defaultInterval: cdk.Duration.days(30),
  });

  // Define custom metrics namespace
  const namespace = 'GarmaxAI/CostOptimization';

  // 1. Cumulative Idle Hours Line Graph
  const idleHoursMetric = new cloudwatch.Metric({
    namespace,
    metricName: 'IdleHours',
    dimensionsMap: { Stage: stage },
    statistic: 'Sum',
    period: cdk.Duration.days(1),
  });

  const idleHoursWidget = new cloudwatch.GraphWidget({
    title: `${stage} - Cumulative Idle Hours`,
    left: [idleHoursMetric],
    width: 12,
    height: 6,
    leftYAxis: {
      label: 'Hours',
      showUnits: false,
    },
    legendPosition: cloudwatch.LegendPosition.BOTTOM,
  });

  // 2. Cost Savings Line Graph
  const costSavingsMetric = new cloudwatch.Metric({
    namespace,
    metricName: 'CostSavings',
    dimensionsMap: { Stage: stage },
    statistic: 'Sum',
    period: cdk.Duration.days(1),
  });

  const costSavingsWidget = new cloudwatch.GraphWidget({
    title: `${stage} - Daily Cost Savings`,
    left: [costSavingsMetric],
    width: 12,
    height: 6,
    leftYAxis: {
      label: 'USD ($)',
      showUnits: false,
    },
    legendPosition: cloudwatch.LegendPosition.BOTTOM,
  });

  // 3. Monthly Savings Number Widget
  const monthlySavingsMetric = new cloudwatch.MathExpression({
    expression: 'FILL(m1, 0)',
    usingMetrics: {
      m1: costSavingsMetric,
    },
    period: cdk.Duration.days(30),
  });

  const monthlySavingsWidget = new cloudwatch.SingleValueWidget({
    title: `${stage} - Monthly Savings`,
    metrics: [monthlySavingsMetric],
    width: 6,
    height: 4,
    setPeriodToTimeRange: true,
  });

  // 4. Total Idle Hours This Month
  const monthlyIdleHoursMetric = new cloudwatch.MathExpression({
    expression: 'FILL(m1, 0)',
    usingMetrics: {
      m1: idleHoursMetric,
    },
    period: cdk.Duration.days(30),
  });

  const monthlyIdleHoursWidget = new cloudwatch.SingleValueWidget({
    title: `${stage} - Total Idle Hours (30d)`,
    metrics: [monthlyIdleHoursMetric],
    width: 6,
    height: 4,
    setPeriodToTimeRange: true,
  });

  // 5. Resource-Specific Idle Hours
  const rdsIdleMetric = new cloudwatch.Metric({
    namespace,
    metricName: 'RDSIdleHours',
    dimensionsMap: { Stage: stage },
    statistic: 'Sum',
    period: cdk.Duration.days(1),
  });

  const elasticacheIdleMetric = new cloudwatch.Metric({
    namespace,
    metricName: 'ElastiCacheIdleHours',
    dimensionsMap: { Stage: stage },
    statistic: 'Sum',
    period: cdk.Duration.days(1),
  });

  const natIdleMetric = new cloudwatch.Metric({
    namespace,
    metricName: 'NATGatewayIdleHours',
    dimensionsMap: { Stage: stage },
    statistic: 'Sum',
    period: cdk.Duration.days(1),
  });

  const resourceBreakdownWidget = new cloudwatch.GraphWidget({
    title: `${stage} - Idle Hours by Resource`,
    left: [rdsIdleMetric, elasticacheIdleMetric, natIdleMetric],
    width: 12,
    height: 6,
    leftYAxis: {
      label: 'Hours',
      showUnits: false,
    },
    legendPosition: cloudwatch.LegendPosition.BOTTOM,
    stacked: true,
  });

  // 6. Savings Breakdown Pie Chart (using bar chart as CloudWatch doesn't support pie)
  const savingsBreakdownWidget = new cloudwatch.GraphWidget({
    title: `${stage} - Savings by Resource Type (30d)`,
    left: [
      new cloudwatch.MathExpression({
        expression: 'm1 * 0.0833',
        usingMetrics: { m1: rdsIdleMetric },
        label: 'RDS Aurora',
        period: cdk.Duration.days(30),
      }),
      new cloudwatch.MathExpression({
        expression: 'm1 * 0.0181',
        usingMetrics: { m1: elasticacheIdleMetric },
        label: 'ElastiCache',
        period: cdk.Duration.days(30),
      }),
      new cloudwatch.MathExpression({
        expression: 'm1 * 0.0444',
        usingMetrics: { m1: natIdleMetric },
        label: 'NAT Gateway',
        period: cdk.Duration.days(30),
      }),
    ],
    width: 12,
    height: 6,
    leftYAxis: {
      label: 'USD ($)',
      showUnits: false,
    },
    legendPosition: cloudwatch.LegendPosition.BOTTOM,
    view: cloudwatch.GraphWidgetView.BAR,
  });

  // 7. Step Functions Execution Status
  let executionWidgets: cloudwatch.IWidget[] = [];

  if (props.teardownStateMachine) {
    const teardownSuccessMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsSucceeded',
      dimensionsMap: {
        StateMachineArn: props.teardownStateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.days(1),
    });

    const teardownFailedMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsFailed',
      dimensionsMap: {
        StateMachineArn: props.teardownStateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.days(1),
    });

    executionWidgets.push(
      new cloudwatch.GraphWidget({
        title: `${stage} - Teardown Executions`,
        left: [teardownSuccessMetric, teardownFailedMetric],
        width: 12,
        height: 5,
        legendPosition: cloudwatch.LegendPosition.BOTTOM,
      })
    );
  }

  if (props.restoreStateMachine) {
    const restoreSuccessMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsSucceeded',
      dimensionsMap: {
        StateMachineArn: props.restoreStateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.days(1),
    });

    const restoreFailedMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsFailed',
      dimensionsMap: {
        StateMachineArn: props.restoreStateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.days(1),
    });

    executionWidgets.push(
      new cloudwatch.GraphWidget({
        title: `${stage} - Restore Executions`,
        left: [restoreSuccessMetric, restoreFailedMetric],
        width: 12,
        height: 5,
        legendPosition: cloudwatch.LegendPosition.BOTTOM,
      })
    );
  }

  // 8. Average Restore Duration
  if (props.restoreStateMachine) {
    const restoreDurationMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionTime',
      dimensionsMap: {
        StateMachineArn: props.restoreStateMachine.stateMachineArn,
      },
      statistic: 'Average',
      period: cdk.Duration.days(1),
    });

    executionWidgets.push(
      new cloudwatch.SingleValueWidget({
        title: `${stage} - Avg Restore Duration`,
        metrics: [restoreDurationMetric],
        width: 6,
        height: 4,
      })
    );
  }

  // 9. Efficiency Score (idle % of total hours)
  const efficiencyWidget = new cloudwatch.GraphWidget({
    title: `${stage} - Idle Efficiency (%)`,
    left: [
      new cloudwatch.MathExpression({
        expression: '(m1 / (24 * PERIOD(m1) / 86400)) * 100',
        usingMetrics: { m1: idleHoursMetric },
        label: 'Idle %',
      }),
    ],
    width: 12,
    height: 6,
    leftYAxis: {
      label: 'Percentage',
      min: 0,
      max: 100,
    },
    legendPosition: cloudwatch.LegendPosition.BOTTOM,
  });

  // 10. Text Widget with Instructions
  const instructionsWidget = new cloudwatch.TextWidget({
    markdown: `# GarmaxAI ${stage} Cost Optimization Dashboard

## 📊 Dashboard Overview
This dashboard tracks cost savings achieved through automated idle resource management.

**Idle Thresholds:**
- DEV: 1 hour
- QA: 2 hours  
- PROD: 24 hours

**Cost Rates:**
- RDS Aurora: $0.0833/hr ($60/mo)
- ElastiCache: $0.0181/hr ($13/mo)
- NAT Gateway: $0.0444/hr ($32/mo)
- ECS Fargate: $0.0417/hr ($30/mo)
- Total: **$0.2902/hr** ($209.40/mo at 100% idle)

## 🎯 Target Monthly Savings
**$209.40** (if idle 24/7)

## 📈 Key Metrics
- **Cumulative Idle Hours**: Total hours resources were idle
- **Daily Cost Savings**: Money saved each day
- **Monthly Savings**: Rolling 30-day savings total
- **Resource Breakdown**: Which resources contribute most to savings

## 🔧 Actions
- Review approval emails for PROD teardowns
- Monitor failed executions for issues
- Check S3 bucket for detailed JSON reports
`,
    width: 12,
    height: 8,
  });

  // Assemble dashboard
  dashboard.addWidgets(instructionsWidget);
  dashboard.addWidgets(monthlySavingsWidget, monthlyIdleHoursWidget);
  dashboard.addWidgets(idleHoursWidget, costSavingsWidget);
  dashboard.addWidgets(resourceBreakdownWidget, savingsBreakdownWidget);
  dashboard.addWidgets(efficiencyWidget);

  if (executionWidgets.length > 0) {
    dashboard.addWidgets(...executionWidgets);
  }

  // Output dashboard URL
  new cdk.CfnOutput(scope, `CostDashboardUrl-${stage}`, {
    value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(scope).region}#dashboards:name=${dashboard.dashboardName}`,
    description: `Cost optimization dashboard URL for ${stage}`,
    exportName: `GarmaxAi-CostDashboardUrl-${stage}`,
  });

  return dashboard;
}

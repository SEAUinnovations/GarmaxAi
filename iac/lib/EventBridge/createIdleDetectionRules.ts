import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

interface IdleDetectionRuleProps {
  stage: string;
  teardownStateMachine: sfn.IStateMachine;
  idleThresholdHours: number; // 1 for DEV, 2 for QA, 24 for PROD
}

/**
 * EventBridge rule to detect idle conditions and trigger teardown
 */
export function createIdleDetectionRule(scope: Construct, props: IdleDetectionRuleProps): events.Rule {
  const { stage, teardownStateMachine, idleThresholdHours } = props;

  // Create EventBridge scheduled rule to check for idle conditions
  // Run every hour to check if environment has been idle
  const rule = new events.Rule(scope, `IdleDetectionRule-${stage}`, {
    ruleName: `GarmaxAi-IdleDetection-${stage}`,
    description: `Check for idle conditions every hour and trigger teardown if idle for ${idleThresholdHours} hours`,
    schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    enabled: true,
  });

  // Add Step Functions target
  rule.addTarget(
    new targets.SfnStateMachine(teardownStateMachine, {
      input: events.RuleTargetInput.fromObject({
        source: 'idle-detection',
        stage,
        idleThresholdHours,
        triggeredAt: events.EventField.time,
      }),
      retryAttempts: 2,
    })
  );

  // Output the rule ARN
  new cdk.CfnOutput(scope, `IdleDetectionRuleArn-${stage}`, {
    value: rule.ruleArn,
    description: `Idle detection rule ARN for ${stage}`,
    exportName: `GarmaxAi-IdleDetectionRuleArn-${stage}`,
  });

  return rule;
}

interface ActivityDetectionRuleProps {
  stage: string;
  restoreStateMachine: sfn.IStateMachine;
  activityMetric?: cloudwatch.IMetric;
}

/**
 * EventBridge rule to detect activity and trigger restore
 */
export function createActivityDetectionRule(scope: Construct, props: ActivityDetectionRuleProps): events.Rule {
  const { stage, restoreStateMachine } = props;

  // Create EventBridge rule for API activity detection
  // This would typically be triggered by CloudWatch alarms or custom events
  const rule = new events.Rule(scope, `ActivityDetectionRule-${stage}`, {
    ruleName: `GarmaxAi-ActivityDetection-${stage}`,
    description: `Detect user activity and trigger environment restore`,
    eventPattern: {
      source: ['garmaxai.activity'],
      detailType: ['User Activity Detected', 'API Request Received'],
      detail: {
        stage: [stage],
      },
    },
    enabled: true,
  });

  // Add Step Functions target
  rule.addTarget(
    new targets.SfnStateMachine(restoreStateMachine, {
      input: events.RuleTargetInput.fromObject({
        source: 'activity-detection',
        stage,
        triggeredAt: events.EventField.time,
        activityType: events.EventField.fromPath('$.detail.activityType'),
      }),
      retryAttempts: 2,
    })
  );

  // Output the rule ARN
  new cdk.CfnOutput(scope, `ActivityDetectionRuleArn-${stage}`, {
    value: rule.ruleArn,
    description: `Activity detection rule ARN for ${stage}`,
    exportName: `GarmaxAi-ActivityDetectionRuleArn-${stage}`,
  });

  return rule;
}

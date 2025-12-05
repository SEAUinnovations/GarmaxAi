import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Stack } from 'aws-cdk-lib';

interface IdleTeardownRulesProps {
  stage: string;
  teardownOrchestrator: lambda.IFunction;
  restoreOrchestrator: lambda.IFunction;
}

/**
 * Creates EventBridge rules for automated idle detection and resource restoration
 * 
 * Rules created:
 * 1. Idle Detection Rule - Scheduled check for idle conditions
 *    - DEV: Every 1 hour
 *    - QA: Every 2 hours
 *    - PROD: Every 8 hours (beta safety buffer)
 * 
 * 2. Activity Detection Rule - Triggered by user activity events
 *    - Listens for 'garmaxai.activity' events
 *    - Automatically restores resources when activity detected
 */
export function createIdleTeardownRules(stack: Stack, props: IdleTeardownRulesProps): {
  idleDetectionRule: events.Rule;
  activityDetectionRule: events.Rule;
} {
  const { stage, teardownOrchestrator, restoreOrchestrator } = props;

  // Idle thresholds: DEV=1hr, QA=2hr, PROD=8hr (beta safety buffer)
  const idleHours = stage === 'prod' ? 8 : stage === 'qa' ? 2 : 1;

  // Scheduled rule to check for idle conditions
  const idleDetectionRule = new events.Rule(stack, `IdleDetectionRule-${stage}`, {
    ruleName: `GarmaxAi-IdleDetection-${stage}`,
    description: `Check for ${idleHours}hr idle and trigger teardown for ${stage}`,
    schedule: events.Schedule.rate(cdk.Duration.hours(idleHours)),
    enabled: true,
  });

  idleDetectionRule.addTarget(
    new targets.LambdaFunction(teardownOrchestrator, {
      event: events.RuleTargetInput.fromObject({
        source: 'idle-detection',
        stage,
        idleThresholdHours: idleHours,
        resource: 'all',
        triggeredAt: events.EventField.time,
      }),
      retryAttempts: 2,
    })
  );

  // Activity detection rule for automatic restore
  const activityDetectionRule = new events.Rule(stack, `ActivityDetectionRule-${stage}`, {
    ruleName: `GarmaxAi-ActivityDetection-${stage}`,
    description: `Detect activity and trigger restore for ${stage}`,
    eventPattern: {
      source: ['garmaxai.activity'],
      detailType: ['User Activity Detected', 'API Request Received'],
      detail: {
        stage: [stage],
      },
    },
    enabled: true,
  });

  activityDetectionRule.addTarget(
    new targets.LambdaFunction(restoreOrchestrator, {
      event: events.RuleTargetInput.fromObject({
        source: 'activity-detection',
        stage,
        resource: 'all',
        wait: true,
        triggeredAt: events.EventField.time,
      }),
      retryAttempts: 2,
    })
  );

  new cdk.CfnOutput(stack, `IdleDetectionRuleArn-${stage}`, {
    value: idleDetectionRule.ruleArn,
    exportName: `IdleDetectionRule-${stage}`,
  });

  new cdk.CfnOutput(stack, `ActivityDetectionRuleArn-${stage}`, {
    value: activityDetectionRule.ruleArn,
    exportName: `ActivityDetectionRule-${stage}`,
  });

  return { idleDetectionRule, activityDetectionRule };
}

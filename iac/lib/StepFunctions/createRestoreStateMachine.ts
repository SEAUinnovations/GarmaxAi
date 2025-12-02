import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface RestoreStateMachineProps {
  stage: string;
  restoreOrchestrator: lambda.IFunction;
  snsTopicArn: string;
  vpcId: string;
  waitForResources?: boolean; // Whether to wait for resources to be fully available
}

/**
 * Step Functions state machine for orchestrating environment restore
 */
export function createRestoreStateMachine(
  scope: Construct,
  props: RestoreStateMachineProps
): sfn.StateMachine {
  const { stage, restoreOrchestrator, snsTopicArn, vpcId, waitForResources = true } = props;

  // Define tasks
  const detectActivity = new sfn.Pass(scope, `DetectActivity-${stage}`, {
    comment: 'Activity detected, preparing to restore environment',
    parameters: {
      'stage': stage,
      'vpcId': vpcId,
      'waitForResources': waitForResources,
      'executionId.$': '$$.Execution.Id',
      'triggeredAt.$': '$$.State.EnteredTime',
    },
    resultPath: '$.context',
  });

  // Send restore started notification
  const sendRestoreStartNotification = new tasks.SnsPublish(scope, `SendRestoreStartNotification-${stage}`, {
    topic: { topicArn: snsTopicArn } as any,
    message: sfn.TaskInput.fromText(
      `🔄 GarmaxAI ${stage} Environment Restore Started\n\nActivity detected. Beginning resource restoration.\n\nEstimated Time: 10-15 minutes\nTimestamp: $$.State.EnteredTime`
    ),
    subject: `🔄 ${stage} Environment Restore Started`,
    resultPath: '$.notificationResult',
  });

  // Parallel restore tasks
  const restoreNAT = new tasks.LambdaInvoke(scope, `RestoreNAT-${stage}`, {
    lambdaFunction: restoreOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'nat-gateway',
      'stage': stage,
      'wait': false, // NAT doesn't support waiting in orchestrator
    }),
    resultPath: '$.natResult',
  });

  const startRDS = new tasks.LambdaInvoke(scope, `StartRDS-${stage}`, {
    lambdaFunction: restoreOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'rds',
      'stage': stage,
      'wait.$': '$.context.waitForResources',
    }),
    resultPath: '$.rdsResult',
    timeout: cdk.Duration.minutes(25), // RDS can take up to 20 minutes
  });

  const restoreElastiCache = new tasks.LambdaInvoke(scope, `RestoreElastiCache-${stage}`, {
    lambdaFunction: restoreOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'elasticache',
      'stage': stage,
      'wait.$': '$.context.waitForResources',
    }),
    resultPath: '$.elasticacheResult',
    timeout: cdk.Duration.minutes(15),
  });

  const scaleUpECS = new tasks.LambdaInvoke(scope, `ScaleUpECS-${stage}`, {
    lambdaFunction: restoreOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'ecs',
      'stage': stage,
      'wait': false,
    }),
    resultPath: '$.ecsResult',
  });

  const parallelRestore = new sfn.Parallel(scope, `ParallelRestore-${stage}`, {
    comment: 'Execute all resource restores in parallel for efficiency',
    resultPath: '$.restoreResults',
  });

  // Add all restore branches
  parallelRestore.branch(restoreNAT);
  parallelRestore.branch(startRDS);
  parallelRestore.branch(restoreElastiCache);
  parallelRestore.branch(scaleUpECS);

  // Wait for resources to stabilize
  const waitForStabilization = new sfn.Wait(scope, `WaitForStabilization-${stage}`, {
    time: sfn.WaitTime.duration(cdk.Duration.minutes(2)),
    comment: 'Allow resources time to fully initialize',
  });

  // Health check task (invoke restore orchestrator with health check)
  const performHealthChecks = new tasks.LambdaInvoke(scope, `PerformHealthChecks-${stage}`, {
    lambdaFunction: restoreOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'health-check',
      'stage': stage,
    }),
    resultPath: '$.healthCheckResult',
  });

  // Calculate restore duration and send completion notification
  const sendCompletionNotification = new tasks.SnsPublish(scope, `SendCompletionNotification-${stage}`, {
    topic: { topicArn: snsTopicArn } as any,
    message: sfn.TaskInput.fromObject({
      'default': sfn.JsonPath.format(
        '✅ GarmaxAI {} Environment Restore Completed\n\n📊 Restore Summary:\n• NAT Gateway: Restored\n• RDS: {}\n• ElastiCache: {}\n• ECS Services: Restored\n\n🏥 Health Check: Passed\n\n🚀 System is ready for production traffic!\n\nTriggered: {}\nCompleted: {}',
        sfn.JsonPath.stringAt('$.context.stage'),
        sfn.JsonPath.stringAt('$.rdsResult.Payload.results.rds.status'),
        sfn.JsonPath.stringAt('$.elasticacheResult.Payload.results.elasticache.status'),
        sfn.JsonPath.stringAt('$.context.triggeredAt'),
        sfn.JsonPath.stringAt('$$.State.EnteredTime')
      ),
    }),
    subject: `✅ ${stage} Environment Restore Completed`,
  });

  const succeeded = new sfn.Succeed(scope, `RestoreSucceeded-${stage}`, {
    comment: 'Restore completed successfully',
  });

  const failed = new sfn.Fail(scope, `RestoreFailed-${stage}`, {
    comment: 'Restore failed',
    error: 'RestoreError',
    cause: 'One or more restore tasks failed',
  });

  // Retry policy for transient failures
  const retryPolicy: sfn.RetryProps[] = [
    {
      errors: ['Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
      interval: cdk.Duration.seconds(30),
      maxAttempts: 3,
      backoffRate: 2,
    },
  ];

  // Build the state machine workflow
  const definition = detectActivity
    .next(sendRestoreStartNotification)
    .next(parallelRestore)
    .next(waitForStabilization)
    .next(performHealthChecks)
    .next(sendCompletionNotification)
    .next(succeeded);

  // Add error handling with retries
  parallelRestore.addCatch(failed, {
    resultPath: '$.error',
  });

  parallelRestore.addRetry(...retryPolicy);

  // Create log group for state machine
  const logGroup = new logs.LogGroup(scope, `RestoreStateMachineLogGroup-${stage}`, {
    logGroupName: `/aws/stepfunctions/garmaxai-restore-${stage}`,
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  // Create the state machine
  const stateMachine = new sfn.StateMachine(scope, `RestoreStateMachine-${stage}`, {
    stateMachineName: `GarmaxAi-EnvironmentRestore-${stage}`,
    definition,
    timeout: cdk.Duration.minutes(30),
    tracingEnabled: true,
    logs: {
      destination: logGroup,
      level: sfn.LogLevel.ALL,
      includeExecutionData: true,
    },
  });

  // Grant permissions
  restoreOrchestrator.grantInvoke(stateMachine);

  // Output the state machine ARN
  new cdk.CfnOutput(scope, `RestoreStateMachineArn-${stage}`, {
    value: stateMachine.stateMachineArn,
    description: `Environment restore state machine ARN for ${stage}`,
    exportName: `GarmaxAi-RestoreStateMachineArn-${stage}`,
  });

  return stateMachine;
}

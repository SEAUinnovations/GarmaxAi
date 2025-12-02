import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface TeardownStateMachineProps {
  stage: string;
  approvalHandler: lambda.IFunction;
  teardownOrchestrator: lambda.IFunction;
  snsTopicArn: string;
  vpcId: string;
  rdsClusterId?: string;
  redisClusterId?: string;
  ecsCluster?: string;
}

/**
 * Step Functions state machine for orchestrating idle teardown with approval workflow
 */
export function createTeardownStateMachine(
  scope: Construct,
  props: TeardownStateMachineProps
): sfn.StateMachine {
  const { stage, approvalHandler, teardownOrchestrator, snsTopicArn, vpcId, rdsClusterId, redisClusterId, ecsCluster } =
    props;

  // Define tasks
  const checkIdleConditions = new sfn.Pass(scope, `CheckIdleConditions-${stage}`, {
    comment: 'Validate idle conditions and prepare teardown context',
    parameters: {
      'stage': stage,
      'vpcId': vpcId,
      'rdsClusterId': rdsClusterId,
      'redisClusterId': redisClusterId,
      'ecsCluster': ecsCluster,
      'executionId.$': '$$.Execution.Id',
      'executionArn.$': '$$.Execution.Id',
    },
    resultPath: '$.context',
  });

  // Send approval request (PROD only)
  const sendApprovalRequest = new tasks.LambdaInvoke(scope, `SendApprovalRequest-${stage}`, {
    lambdaFunction: approvalHandler,
    payload: sfn.TaskInput.fromObject({
      'action': 'request',
      'stage': stage,
      'executionArn.$': '$.context.executionArn',
    }),
    resultPath: '$.approval',
  });

  // Wait for approval (2 hours)
  const waitForApproval = new sfn.Wait(scope, `WaitForApproval-${stage}`, {
    time: sfn.WaitTime.duration(cdk.Duration.hours(2)),
  });

  // Check approval status
  const checkApprovalStatus = new tasks.LambdaInvoke(scope, `CheckApprovalStatus-${stage}`, {
    lambdaFunction: approvalHandler,
    payload: sfn.TaskInput.fromObject({
      'action': 'check',
      'approvalId.$': '$.approval.Payload.approvalId',
    }),
    resultPath: '$.approvalResult',
  });

  // Auto-approve for DEV/QA
  const autoApprove = new sfn.Pass(scope, `AutoApprove-${stage}`, {
    comment: 'DEV/QA environments auto-approve after timeout',
    result: sfn.Result.fromObject({ approved: true }),
    resultPath: '$.approvalResult',
  });

  // Retry next day for PROD
  const scheduleRetry = new tasks.SnsPublish(scope, `ScheduleRetry-${stage}`, {
    topic: { topicArn: snsTopicArn } as any,
    message: sfn.TaskInput.fromText(
      `⏰ PROD Idle Teardown Approval Timeout\n\nApproval not received within 2 hours. Will retry during next idle detection window.\n\nStage: ${stage}\nExecution: $.context.executionId`
    ),
    subject: `⏰ ${stage} Teardown Approval Timeout - Retry Scheduled`,
  });

  const teardownDenied = new tasks.SnsPublish(scope, `TeardownDenied-${stage}`, {
    topic: { topicArn: snsTopicArn } as any,
    message: sfn.TaskInput.fromText('🛑 Teardown request was denied by administrator.'),
    subject: `🛑 ${stage} Teardown Denied`,
  });

  // Parallel teardown tasks
  const stopRDS = new tasks.LambdaInvoke(scope, `StopRDS-${stage}`, {
    lambdaFunction: teardownOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'rds',
      'stage': stage,
      'clusterId.$': '$.context.rdsClusterId',
    }),
    resultPath: '$.rdsResult',
  });

  const teardownElastiCache = new tasks.LambdaInvoke(scope, `TeardownElastiCache-${stage}`, {
    lambdaFunction: teardownOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'elasticache',
      'stage': stage,
      'redisClusterId.$': '$.context.redisClusterId',
    }),
    resultPath: '$.elasticacheResult',
  });

  const scaleDownECS = new tasks.LambdaInvoke(scope, `ScaleDownECS-${stage}`, {
    lambdaFunction: teardownOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'ecs',
      'stage': stage,
      'ecsCluster.$': '$.context.ecsCluster',
    }),
    resultPath: '$.ecsResult',
  });

  const teardownNAT = new tasks.LambdaInvoke(scope, `TeardownNAT-${stage}`, {
    lambdaFunction: teardownOrchestrator,
    payload: sfn.TaskInput.fromObject({
      'resource': 'nat-gateway',
      'stage': stage,
      'vpcId.$': '$.context.vpcId',
    }),
    resultPath: '$.natResult',
  });

  const parallelTeardown = new sfn.Parallel(scope, `ParallelTeardown-${stage}`, {
    comment: 'Execute all resource teardowns in parallel for efficiency',
    resultPath: '$.teardownResults',
  });

  // Add branches only if resources are configured
  if (rdsClusterId) parallelTeardown.branch(stopRDS);
  if (redisClusterId) parallelTeardown.branch(teardownElastiCache);
  if (ecsCluster) parallelTeardown.branch(scaleDownECS);
  parallelTeardown.branch(teardownNAT); // Always teardown NAT Gateway

  // Send completion notification
  const sendCompletionNotification = new tasks.SnsPublish(scope, `SendCompletionNotification-${stage}`, {
    topic: { topicArn: snsTopicArn } as any,
    message: sfn.TaskInput.fromObject({
      'default': sfn.JsonPath.format(
        '✅ {} Idle Teardown Completed\n\nAll resources have been successfully torn down.\n\nExecution: {}\nTimestamp: {}',
        sfn.JsonPath.stringAt('$.context.stage'),
        sfn.JsonPath.stringAt('$.context.executionId'),
        sfn.JsonPath.stringAt('$$.State.EnteredTime')
      ),
    }),
    subject: `✅ ${stage} Idle Teardown Completed`,
  });

  const succeeded = new sfn.Succeed(scope, `TeardownSucceeded-${stage}`, {
    comment: 'Teardown completed successfully',
  });

  const failed = new sfn.Fail(scope, `TeardownFailed-${stage}`, {
    comment: 'Teardown failed',
    error: 'TeardownError',
    cause: 'One or more teardown tasks failed',
  });

  const cancelled = new sfn.Succeed(scope, `TeardownCancelled-${stage}`, {
    comment: 'Teardown cancelled - approval denied or timeout',
  });

  // Build the state machine workflow
  let approvalFlow: sfn.IChainable;

  if (stage === 'PROD') {
    // PROD: Send approval, wait, check status
    approvalFlow = sendApprovalRequest
      .next(waitForApproval)
      .next(checkApprovalStatus)
      .next(
        new sfn.Choice(scope, `ApprovalDecision-${stage}`)
          .when(sfn.Condition.booleanEquals('$.approvalResult.Payload.approved', true), parallelTeardown)
          .when(sfn.Condition.booleanEquals('$.approvalResult.Payload.approved', false), teardownDenied.next(cancelled))
          .otherwise(scheduleRetry.next(cancelled)) // Timeout - retry next day
      );
  } else {
    // DEV/QA: Auto-approve after timeout
    approvalFlow = sendApprovalRequest
      .next(waitForApproval)
      .next(autoApprove)
      .next(parallelTeardown);
  }

  const definition = checkIdleConditions
    .next(approvalFlow)
    .next(sendCompletionNotification)
    .next(succeeded);

  // Add error handling
  parallelTeardown.addCatch(failed, {
    resultPath: '$.error',
  });

  // Create log group for state machine
  const logGroup = new logs.LogGroup(scope, `TeardownStateMachineLogGroup-${stage}`, {
    logGroupName: `/aws/stepfunctions/garmaxai-teardown-${stage}`,
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  // Create the state machine
  const stateMachine = new sfn.StateMachine(scope, `TeardownStateMachine-${stage}`, {
    stateMachineName: `GarmaxAi-IdleTeardown-${stage}`,
    definition,
    timeout: cdk.Duration.hours(3),
    tracingEnabled: true,
    logs: {
      destination: logGroup,
      level: sfn.LogLevel.ALL,
      includeExecutionData: true,
    },
  });

  // Grant permissions
  approvalHandler.grantInvoke(stateMachine);
  teardownOrchestrator.grantInvoke(stateMachine);

  // Output the state machine ARN
  new cdk.CfnOutput(scope, `TeardownStateMachineArn-${stage}`, {
    value: stateMachine.stateMachineArn,
    description: `Idle teardown state machine ARN for ${stage}`,
    exportName: `GarmaxAi-TeardownStateMachineArn-${stage}`,
  });

  return stateMachine;
}

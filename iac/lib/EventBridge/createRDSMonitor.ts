import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface RDSMonitorProps {
  stage: string;
  rdsRestartDetector: lambda.IFunction;
}

/**
 * EventBridge rule to detect RDS auto-restarts via CloudTrail
 */
export function createRDSMonitor(scope: Construct, props: RDSMonitorProps): events.Rule {
  const { stage, rdsRestartDetector } = props;

  // Create EventBridge rule for RDS StartDBCluster events
  const rule = new events.Rule(scope, `RDSAutoRestartMonitor-${stage}`, {
    ruleName: `GarmaxAi-RDSAutoRestart-${stage}`,
    description: `Detect RDS auto-restarts after 7 days and re-stop if environment is idle`,
    eventPattern: {
      source: ['aws.rds'],
      detailType: ['AWS API Call via CloudTrail'],
      detail: {
        eventSource: ['rds.amazonaws.com'],
        eventName: ['StartDBCluster'],
        // Filter for clusters matching the naming pattern
        requestParameters: {
          dBClusterIdentifier: [
            {
              prefix: `garmaxai-${stage.toLowerCase()}`,
            },
          ],
        },
      },
    },
    enabled: true,
  });

  // Add Lambda target
  rule.addTarget(
    new targets.LambdaFunction(rdsRestartDetector, {
      retryAttempts: 2,
      maxEventAge: cdk.Duration.minutes(5),
    })
  );

  // Grant Lambda permission to be invoked by EventBridge
  rdsRestartDetector.addPermission(`InvokeByEventBridge-${stage}`, {
    principal: new iam.ServicePrincipal('events.amazonaws.com'),
    sourceArn: rule.ruleArn,
  });

  // Output the rule ARN
  new cdk.CfnOutput(scope, `RDSMonitorRuleArn-${stage}`, {
    value: rule.ruleArn,
    description: `RDS auto-restart monitor rule ARN for ${stage}`,
    exportName: `GarmaxAi-RDSMonitorRuleArn-${stage}`,
  });

  return rule;
}

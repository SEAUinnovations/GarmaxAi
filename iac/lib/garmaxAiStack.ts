import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getEnvironmentConfig } from '../../parameters/config';
import { SharedInfraStack } from './stacks/SharedInfraStack';
import { BackendStack } from './stacks/BackendStack';
import { FrontendStack } from './stacks/FrontendStack';
import createBudgetMonitoring from './Monitoring/createBudgetMonitoring';

export class GarmaxAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Get environment configuration based on STAGE environment variable
    const stage = process.env.STAGE || 'dev';
    const env = getEnvironmentConfig(stage);

    // Deploy nested stacks for shared infrastructure, backend, and frontend
    const sharedInfraStack = new SharedInfraStack(this, `SharedInfra-${stage}`, {
      stage,
    });

    const backendStack = new BackendStack(this, `Backend-${stage}`, {
      stage,
      vpc: sharedInfraStack.vpc,
      uploadsBucket: sharedInfraStack.uploadsBucket,
      guidanceBucket: sharedInfraStack.guidanceBucket,
      rendersBucket: sharedInfraStack.rendersBucket,
      smplAssetsBucket: sharedInfraStack.smplAssetsBucket,
      apiKeyParameters: sharedInfraStack.apiKeyParameters,
      env,
    });

    const frontendStack = new FrontendStack(this, `Frontend-${stage}`, {
      stage,
      staticSiteBucket: sharedInfraStack.staticSiteBucket,
      apiUrl: backendStack.apiGateway.url,
      apiDomainName: backendStack.apiDomainName,
      apiStageName: backendStack.apiGateway.deploymentStage?.stageName,
      env,
    });

    // Create budget monitoring and alarms ($50/day threshold)
    const budgetMonitoring = createBudgetMonitoring(this, {
      stage: env.STAGE,
      dailyBudgetUsd: env.DAILY_BUDGET_USD || 50,
      alertEmail: env.ALERT_EMAIL || 'alerts@garmaxai.com',
    });

    // Main stack outputs (nested stack outputs are available via their exports)
    new cdk.CfnOutput(this, `Stage`, {
      value: stage,
      exportName: `GarmaxAi-Stage`,
    });

    new cdk.CfnOutput(this, `Region`, {
      value: this.region,
      exportName: `GarmaxAi-Region`,
    });
  }
}

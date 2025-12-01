import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import createPythonLambda from './Lambda/createLambda';
import createApiGateway from './Api/createApiGateway';
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
    // Get environment configuration based on STAGE environment variable
    const stage = process.env.STAGE || 'dev';
    const env = getEnvironmentConfig(stage);
    
    const vpc = createVpc(this, this.region || cdk.Stack.of(this).region);

    // Create a Python Lambda
    const pythonLambda = createPythonLambda(this, 'ModelMeApiLambda');

    // Create API Gateway (RestApi) and integrate with Lambda
    const api = createApiGateway(this, pythonLambda, 'ModelMeApi');

    // Deploy nested stacks for shared infrastructure, backend, and frontend
    const sharedInfraStack = new SharedInfraStack(this, `SharedInfra-${stage}`, {
      stage,
      vpc,
    });

    const backendStack = new BackendStack(this, `Backend-${stage}`, {
      stage,
      vpc: sharedInfraStack.vpc,
      uploadsBucket: sharedInfraStack.uploadsBucket,
      guidanceBucket: sharedInfraStack.guidanceBucket,
      rendersBucket: sharedInfraStack.rendersBucket,
      smplAssetsBucket: sharedInfraStack.smplAssetsBucket,
      logsBucket: sharedInfraStack.logsBucket,
      apiGateway: api,
      pythonLambda,
      env,
    });

    const frontendStack = new FrontendStack(this, `Frontend-${stage}`, {
      stage,
      staticSiteBucket: sharedInfraStack.staticSiteBucket,
      apiGateway: api,
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

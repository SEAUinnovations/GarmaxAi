#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SharedInfraStack } from '../lib/stacks/SharedInfraStack';
import { BackendStack } from '../lib/stacks/BackendStack';
import { FrontendStack } from '../lib/stacks/FrontendStack';
import createBudgetMonitoring from '../lib/Monitoring/createBudgetMonitoring';
import { getEnvironmentConfig } from '../../parameters/config';

const stage = process.env.STAGE || 'dev';
const envConfig = getEnvironmentConfig(stage);

const app = new cdk.App();

const env = {
  region: "us-east-1",
  account: "920792187297",
};

// Create SharedInfraStack first (VPC, S3 buckets, SSM parameters)
const sharedInfraStack = new SharedInfraStack(app, `GarmaxAi-SharedInfra-${stage}`, {
  stackName: `GarmaxAi-SharedInfra-${stage}`,
  stage,
  env,
});

// Create BackendStack (API Gateway, Lambdas, SQS, EventBridge)
const backendStack = new BackendStack(app, `GarmaxAi-Backend-${stage}`, {
  stackName: `GarmaxAi-Backend-${stage}`,
  stage,
  vpc: sharedInfraStack.vpc,
  vpcEndpoints: sharedInfraStack.vpcEndpoints,
  elastiCacheEndpoint: sharedInfraStack.elastiCacheConfig.endpoint,
  elastiCachePort: sharedInfraStack.elastiCacheConfig.port,
  elastiCacheSecurityGroup: sharedInfraStack.elastiCacheSecurityGroup,
  uploadsBucket: sharedInfraStack.uploadsBucket,
  guidanceBucket: sharedInfraStack.guidanceBucket,
  rendersBucket: sharedInfraStack.rendersBucket,
  smplAssetsBucket: sharedInfraStack.smplAssetsBucket,
  apiKeyParameters: sharedInfraStack.apiKeyParameters,
  envConfig: envConfig,
  env,
});

// Create FrontendStack (CloudFront distributions for frontend and API)
// Frontend now reads API info from SSM instead of BackendStack exports to avoid cross-stack dependencies
const frontendStack = new FrontendStack(app, `GarmaxAi-Frontend-${stage}`, {
  stackName: `GarmaxAi-Frontend-${stage}`,
  stage,
  staticSiteBucketName: sharedInfraStack.staticSiteBucket.bucketName,
  envConfig: envConfig,
  env,
});

// Don't add any explicit dependencies - let CDK automatically infer them from resource references
// CDK will ensure proper deployment order based on which resources are used where

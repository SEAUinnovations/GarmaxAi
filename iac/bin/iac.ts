#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GarmaxAiStack } from '../lib/garmaxAiStack';
import { getEnvironmentConfig } from '../../parameters/config';

const stage = process.env.STAGE || 'dev';
const envConfig = getEnvironmentConfig(stage);

const app = new cdk.App();
new GarmaxAiStack(app, 'GarmaxAiStack', {
  stackName: `GarmaxAi-${stage}`,
  env: {
    region: "us-east-1",
    account: "920792187297",
  },
});
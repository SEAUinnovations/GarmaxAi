#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ModelMeStack } from '../lib/modelme-stack';
import { env } from '../../parameters/config';

const app = new cdk.App();
new ModelMeStack(app, 'ModelMeStack', {
   stackName: `ModelMe-BE-${env.STAGE}`,
  env: {
    region:"us-east-1",
    account:"920792187297",
  },
});
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GarmaxAiStack } from '../lib/garmaxAiStack';
import { env } from '../../parameters/config';

const app = new cdk.App();
new GarmaxAiStack(app, 'GarmaxAiStack', {
   stackName: `GarmaxAi-${env.STAGE}`,
  env: {
    region:"us-east-1",
    account:"920792187297",
  },
});
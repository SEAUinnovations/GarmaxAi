import * as cdk from 'aws-cdk-lib';
import { Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export default function createLambda(stack: cdk.Stack, id = 'ModelMeApiLambda') {

const func = new lambda.Function(stack, id, {
    runtime: Runtime.FROM_IMAGE,
    handler: Handler.FROM_IMAGE,
    code: lambda.Code.fromAssetImage('../', {
      file: 'Dockerfile.api',
      exclude: ['iac/cdk.out', 'iac/node_modules', 'client/node_modules', 'node_modules', '.git'],
    }),
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
});

  return func;
}

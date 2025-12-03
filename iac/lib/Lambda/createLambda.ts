import * as cdk from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export default function createLambda(stack: cdk.Stack, id = 'ModelMeApiLambda') {

const func = new lambda.Function(stack, id, {
    runtime: Runtime.NODEJS_20_X,
    handler: 'Handler.FROM_IMAGE',
    code: lambda.Code.fromAssetImage('../../Dockerfile'),
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
});

  return func;
}

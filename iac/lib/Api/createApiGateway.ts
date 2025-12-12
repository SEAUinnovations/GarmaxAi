import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as integrations from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { env } from '../../../parameters/config';

export default function createApiGateway(stack: cdk.Stack, lambdaFn: lambda.Function, id = 'ModelMeApi') {
  
  // Remove API Gateway CORS - let Express handle it for proper credentials support
  // API Gateway's CORS doesn't support dynamic origins with credentials properly
  const api = new apigateway.RestApi(stack, id, {
    restApiName: `${id}-${env.STAGE}`,
    // No defaultCorsPreflightOptions - Express will handle CORS
  });

  const integration = new apigateway.LambdaIntegration(lambdaFn);
  // Add a simple proxy resource to forward all paths
  const proxy = api.root.addResource('{proxy+}');
  proxy.addMethod('ANY', integration);
  api.root.addMethod('ANY', integration);

  return api;
}

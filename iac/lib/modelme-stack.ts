import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import createPythonLambda from './Lambda/createLambda';
import createApiGateway from './Api/createApiGateway';
import createCloudfront from './Cloudfront/createCloudfront';
import createVpc from './VPC/createVPC';
import { env } from '../../parameters/config';

export class ModelMeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = createVpc(this, this.region || cdk.Stack.of(this).region);

    // Create a Python Lambda
    const pythonLambda = createPythonLambda(this, 'ModelMeApiLambda');

    // Create API Gateway (RestApi) and integrate with Lambda
    const api = createApiGateway(this, pythonLambda, 'ModelMeApi');

    // Determine the API domain for CloudFront origin
    const region = this.region || cdk.Stack.of(this).region;
    const apiDomain = api.addDomainName().domainName;

    // Create CloudFront distribution that points to API Gateway and add Route53 record
    createCloudfront(this, env.STAGE, region, undefined, apiDomain, `/${api.deploymentStage?.stageName ?? ''}`);
  }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import createPythonLambda from './Lambda/createLambda';
import createApiGateway from './Api/createApiGateway';
import createCloudfront from './Cloudfront/createCloudfront';
import createFrontend from './Cloudfront/createFrontend';
import createVpc from './VPC/createVPC';
import { env } from '../../parameters/config';
import createStaticSiteBucket from './Storage/createStaticSiteBucket';
import createTryonQueue from './SQS/createTryonQueue';
import createTryonEventBus from './EventBridge/createTryonEventBus';
import * as iam from 'aws-cdk-lib/aws-iam';
import createBillingQueue from './SQS/createBillingQueue';
import createBillingProcessor from './Lambda/createBillingProcessor';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class GarmaxAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = createVpc(this, this.region || cdk.Stack.of(this).region);

    // Create a Python Lambda
    const pythonLambda = createPythonLambda(this, 'ModelMeApiLambda');

    // Create API Gateway (RestApi) and integrate with Lambda
    const api = createApiGateway(this, pythonLambda, 'ModelMeApi');

    // Create SQS and EventBridge bus for app events (incl. Stripe)
    const { tryonQueue } = createTryonQueue(this, env.STAGE);
    const { billingQueue } = createBillingQueue(this, env.STAGE);
    const tryonBus = createTryonEventBus(this, env.STAGE, tryonQueue, billingQueue);

    // Create billing processor Lambda and subscribe it to the billing queue
    const billingProcessor = createBillingProcessor(this, env.STAGE);
    billingProcessor.addEventSource(new SqsEventSource(billingQueue, {
      batchSize: 5,
      reportBatchItemFailures: true,
    }));

    // Allow Lambda to publish to the EventBridge bus
    pythonLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [tryonBus.eventBusArn],
    }));

    // Provide bus/queue details to the Lambda container
    pythonLambda.addEnvironment('EVENTBRIDGE_BUS_NAME', tryonBus.eventBusName);
    pythonLambda.addEnvironment('SQS_QUEUE_URL', tryonQueue.queueUrl);
    pythonLambda.addEnvironment('SQS_BILLING_QUEUE_URL', billingQueue.queueUrl);

    // Determine the API domain for CloudFront origin
    const region = this.region || cdk.Stack.of(this).region;
    const backendDomain = (env as any).backendDomainName || `backend.${env.hostedZoneName}`;
    const apiDomain = api.addDomainName('ApiDomain', {
      domainName: backendDomain,
      certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'ApiCertificate',
        (env as any).BackendAcmCert?.[region]?.id || env.AcmCert[region].id
      ),
    }).domainName;

    // Create CloudFront distribution that points to API Gateway and add Route53 record
    const apiDist = createCloudfront(this, env.STAGE, region, undefined, apiDomain, `/${api.deploymentStage?.stageName ?? ''}`);

    // Frontend static hosting: S3 bucket + CloudFront + custom domain + WAF
    const siteBucket = createStaticSiteBucket(this, env.STAGE);

    const frontendDomain = (env as any).frontendDomainName
      ? (env as any).frontendDomainName
      : env.hostedZoneName;

    const feDist = createFrontend(this, env.STAGE, siteBucket, {
      region,
      domainName: frontendDomain,
      wafArn: (env as any).wafArn,
    });

    new cdk.CfnOutput(this, `FrontendBucketName-${env.STAGE}`, {
      value: siteBucket.bucketName,
      exportName: `FrontendBucketName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `FrontendDistributionId-${env.STAGE}`, {
      value: feDist.distributionId,
      exportName: `FrontendDistributionId-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionId-${env.STAGE}`, {
      value: apiDist.distributionId,
      exportName: `BackendDistributionId-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionDomainName-${env.STAGE}`, {
      value: apiDist.distributionDomainName,
      exportName: `BackendDistributionDomainName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `EventBridgeBusName-${env.STAGE}`, {
      value: tryonBus.eventBusName,
      exportName: `EventBridgeBusName-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `TryonQueueUrl-${env.STAGE}`, {
      value: tryonQueue.queueUrl,
      exportName: `TryonQueueUrl-${env.STAGE}`,
    });

    new cdk.CfnOutput(this, `BillingQueueUrl-${env.STAGE}`, {
      value: billingQueue.queueUrl,
      exportName: `BillingQueueUrl-${env.STAGE}`,
    });
  }
}

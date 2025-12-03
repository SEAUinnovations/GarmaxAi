import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import createCloudfront from '../Cloudfront/createCloudfront';
import createFrontend from '../Cloudfront/createFrontend';

export interface FrontendStackProps extends cdk.NestedStackProps {
  stage: string;
  staticSiteBucket: s3.Bucket;
  apiGateway: cdk.aws_apigateway.RestApi;
  env: any; // Environment configuration
}

/**
 * FrontendStack - Manages frontend infrastructure
 * - CloudFront distributions for frontend and API
 * - S3 static site hosting
 * - Custom domain configuration
 * - WAF integration
 */
export class FrontendStack extends cdk.NestedStack {
  public readonly frontendDistributionId: string;
  public readonly backendDistributionId: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const region = this.region || cdk.Stack.of(this).region;
    
    // Determine the API domain for CloudFront origin
    const backendDomain = (props.env as any).backendDomainName || `backend.${props.env.hostedZoneName}`;
    
    // Only add custom domain if not using placeholder values
    let apiDomain: cdk.aws_apigateway.IDomainName | undefined;
    if (!props.env.hostedZoneName.includes('PLACEHOLDER')) {
      apiDomain = props.apiGateway.addDomainName('ApiDomain', {
        domainName: backendDomain,
        certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
          this,
          'ApiCertificate',
          (props.env as any).BackendAcmCert?.[region]?.id || props.env.AcmCert[region].id
        ),
      });
    }

    // Create CloudFront distribution for API Gateway
    // Use custom domain if configured, otherwise use API Gateway URL directly
    const apiOriginDomain = apiDomain?.domainName || props.apiGateway.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const apiDist = createCloudfront(
      this, 
      props.stage, 
      region, 
      undefined, 
      apiOriginDomain, 
      apiDomain ? `/${props.apiGateway.deploymentStage?.stageName ?? ''}` : ''
    );

    // Create CloudFront distribution for frontend
    const frontendDomain = (props.env as any).frontendDomainName
      ? (props.env as any).frontendDomainName
      : props.env.hostedZoneName;

    const feDist = createFrontend(this, props.stage, props.staticSiteBucket, {
      region,
      domainName: frontendDomain,
      wafArn: (props.env as any).wafArn,
    });

    this.frontendDistributionId = feDist.distributionId;
    this.backendDistributionId = apiDist.distributionId;

    // Outputs
    new cdk.CfnOutput(this, `FrontendBucketName`, {
      value: props.staticSiteBucket.bucketName,
      exportName: `Frontend-BucketName-${props.stage}`,
    });

    new cdk.CfnOutput(this, `FrontendDistributionId`, {
      value: feDist.distributionId,
      exportName: `Frontend-DistributionId-${props.stage}`,
    });

    new cdk.CfnOutput(this, `FrontendDomainName`, {
      value: feDist.distributionDomainName,
      exportName: `Frontend-DomainName-${props.stage}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionId`, {
      value: apiDist.distributionId,
      exportName: `Frontend-BackendDistId-${props.stage}`,
    });

    new cdk.CfnOutput(this, `BackendDistributionDomainName`, {
      value: apiDist.distributionDomainName,
      exportName: `Frontend-BackendDomain-${props.stage}`,
    });
  }
}

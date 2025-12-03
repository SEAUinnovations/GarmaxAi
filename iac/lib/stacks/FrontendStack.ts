import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import createCloudfront from '../Cloudfront/createCloudfront';
import createFrontend from '../Cloudfront/createFrontend';

export interface FrontendStackProps extends cdk.StackProps {
  stage: string;
  staticSiteBucketName: string; // Changed from Bucket object to bucket name string
  apiUrl: string;
  apiDomainName?: string;
  apiStageName?: string;
  envConfig: any; // Environment configuration (domain names, certs, etc.)
}

/**
 * FrontendStack - Manages frontend infrastructure
 * - CloudFront distributions for frontend and API
 * - S3 static site hosting
 * - Custom domain configuration
 * - WAF integration
 */
export class FrontendStack extends cdk.Stack {
  public readonly frontendDistributionId: string;
  public readonly backendDistributionId: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const region = props.env?.region || 'us-east-1';
    
    // Look up the static site bucket by name (avoids circular dependency)
    const staticSiteBucket = s3.Bucket.fromBucketName(
      this,
      'StaticSiteBucket',
      props.staticSiteBucketName
    );
    
    // Create CloudFront distribution for API Gateway
    // Use custom domain if configured, otherwise use API Gateway URL directly
    const apiOriginDomain = props.apiDomainName || props.apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const apiPath = props.apiDomainName && props.apiStageName ? `/${props.apiStageName}` : '';
    
    const apiDist = createCloudfront(
      this, 
      props.stage, 
      region, 
      undefined, 
      apiOriginDomain, 
      apiPath
    );

    // Create CloudFront distribution for frontend
    const frontendDomain = (props.envConfig as any).frontendDomainName
      ? (props.envConfig as any).frontendDomainName
      : props.envConfig.hostedZoneName;

    const feDist = createFrontend(this, props.stage, staticSiteBucket, {
      region,
      domainName: frontendDomain,
      wafArn: (props.envConfig as any).wafArn,
    });

    this.frontendDistributionId = feDist.distributionId;
    this.backendDistributionId = apiDist.distributionId;

    // Outputs
    new cdk.CfnOutput(this, `FrontendBucketName`, {
      value: props.staticSiteBucketName,
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

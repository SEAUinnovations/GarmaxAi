import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import createVpc from '../VPC/createVPC';
import createLogsBucket from '../Storage/createLogsBucket';
import createUploadsBucket from '../Storage/createUploadsBucket';
import createGuidanceBucket from '../Storage/createGuidanceBucket';
import createRendersBucket from '../Storage/createRendersBucket';
import createSmplAssetsBucket from '../Storage/createSmplAssetsBucket';
import createStaticSiteBucket from '../Storage/createStaticSiteBucket';
import { createApiKeyParameters, type ApiKeyParameters } from '../ParameterStore';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface SharedInfraStackProps extends cdk.NestedStackProps {
  stage: string;
}

/**
 * SharedInfraStack - Manages shared infrastructure resources
 * - VPC with public and private subnets
 * - S3 buckets (logs, uploads, guidance, renders, SMPL assets, static site)
 * 
 * These resources are shared across backend and frontend stacks
 */
export class SharedInfraStack extends cdk.NestedStack {
  public readonly vpc: ec2.IVpc;
  public readonly logsBucket: s3.Bucket;
  public readonly uploadsBucket: s3.Bucket;
  public readonly guidanceBucket: s3.Bucket;
  public readonly rendersBucket: s3.Bucket;
  public readonly smplAssetsBucket: s3.Bucket;
  public readonly staticSiteBucket: s3.Bucket;
  public readonly apiKeyParameters: ApiKeyParameters;

  constructor(scope: Construct, id: string, props: SharedInfraStackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    this.vpc = createVpc(this, this.region || cdk.Stack.of(this).region);

    // Create centralized logs bucket first (other buckets will reference it)
    this.logsBucket = createLogsBucket(this, props.stage);
    
    // Create separate S3 buckets for different use cases with proper security and lifecycle
    this.uploadsBucket = createUploadsBucket(this, props.stage, this.logsBucket);
    this.guidanceBucket = createGuidanceBucket(this, props.stage, this.logsBucket);
    this.rendersBucket = createRendersBucket(this, props.stage, this.logsBucket);
    this.smplAssetsBucket = createSmplAssetsBucket(this, props.stage, this.logsBucket);
    this.staticSiteBucket = createStaticSiteBucket(this, props.stage);

    // Create Parameter Store parameters for centralized API key management
    this.apiKeyParameters = createApiKeyParameters(this, { stage: props.stage });

    // Export bucket names for cross-stack reference
    new cdk.CfnOutput(this, `UploadsBucketName`, {
      value: this.uploadsBucket.bucketName,
      exportName: `SharedInfra-UploadsBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `GuidanceBucketName`, {
      value: this.guidanceBucket.bucketName,
      exportName: `SharedInfra-GuidanceBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `RendersBucketName`, {
      value: this.rendersBucket.bucketName,
      exportName: `SharedInfra-RendersBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `SmplAssetsBucketName`, {
      value: this.smplAssetsBucket.bucketName,
      exportName: `SharedInfra-SmplAssetsBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `LogsBucketName`, {
      value: this.logsBucket.bucketName,
      exportName: `SharedInfra-LogsBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `StaticSiteBucketName`, {
      value: this.staticSiteBucket.bucketName,
      exportName: `SharedInfra-StaticSiteBucket-${props.stage}`,
    });
    
    new cdk.CfnOutput(this, `VpcId`, {
      value: this.vpc.vpcId,
      exportName: `SharedInfra-VpcId-${props.stage}`,
    });
  }
}

/**
 * Centralized Logs Bucket
 * 
 * Aggregates access logs from all other S3 buckets in the system for
 * compliance, security monitoring, and usage analytics.
 * 
 * Log Sources:
 * - S3 access logs from uploads, guidance, renders, smpl-assets buckets
 * - CloudFront access logs (if configured)
 * - Application logs from Lambda functions (if S3 log shipping enabled)
 * - VPC Flow Logs (if S3 destination configured)
 * 
 * Prefixes:
 * - s3/uploads-<stage>/ - Uploads bucket access logs
 * - s3/guidance-<stage>/ - Guidance bucket access logs  
 * - s3/renders-<stage>/ - Renders bucket access logs
 * - s3/smpl-assets-<stage>/ - SMPL assets bucket access logs (high security)
 * - cloudfront/<distribution-id>/ - CloudFront access logs
 * - application/<service>/ - Application logs (optional)
 * - vpc/ - VPC Flow Logs (optional)
 * 
 * Security:
 * - Private bucket (logs contain access patterns and metadata)
 * - S3-managed encryption
 * - SSL-only access enforced
 * - No public access ever
 * 
 * Lifecycle:
 * - Recent logs (30 days) in Standard storage for active monitoring
 * - Older logs transition to IA, then Glacier for long-term compliance
 * - Very old logs (7+ years) can be expired based on retention policy
 * - SMPL assets logs retained longer due to security sensitivity
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export default function createLogsBucket(
  stack: cdk.Stack,
  stage: string
) {
  const bucket = new s3.Bucket(stack, `LogsBucket-${stage}`, {
    bucketName: `garmaxai-logs-${stage.toLowerCase()}`,
    
    // Security: Private logs bucket
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    
    // No access logging for logs bucket (avoid circular dependency)
    // No CORS - backend access only for log analysis tools
    
    // Lifecycle rules for compliance and cost optimization
    lifecycleRules: [
      {
        // Standard S3 access logs lifecycle
        id: 's3-access-logs',
        prefix: 's3/',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30),
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(90),
          },
          {
            storageClass: s3.StorageClass.DEEP_ARCHIVE,
            transitionAfter: cdk.Duration.days(365),
          },
        ],
        expiration: cdk.Duration.days(2555), // ~7 years compliance retention
        enabled: true,
      },
      {
        // CloudFront logs lifecycle (higher volume)
        id: 'cloudfront-logs',
        prefix: 'cloudfront/',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(7), // Faster transition due to volume
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(30),
          },
          {
            storageClass: s3.StorageClass.DEEP_ARCHIVE,
            transitionAfter: cdk.Duration.days(90),
          },
        ],
        expiration: cdk.Duration.days(1095), // 3 years for CDN logs
        enabled: true,
      },
      {
        // SMPL assets access logs - extended retention for security compliance
        id: 'smpl-access-logs',
        prefix: 's3/smpl-assets-',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(90), // Keep accessible longer
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(365),
          },
        ],
        expiration: cdk.Duration.days(3650), // 10 years for security-sensitive logs
        enabled: true,
      },
      {
        // Application logs lifecycle
        id: 'application-logs',
        prefix: 'application/',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(14),
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(60),
          },
        ],
        expiration: cdk.Duration.days(730), // 2 years for application logs
        enabled: true,
      },
    ],
    
    // Cleanup on stack deletion (non-production only)
    ...(stage.toLowerCase() !== 'prod' && {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    }),
  });
  
  // CloudFormation outputs
  new cdk.CfnOutput(stack, `LogsBucketName-${stage}`, {
    value: bucket.bucketName,
    exportName: `LogsBucketName-${stage}`,
    description: `Centralized logs S3 bucket name for ${stage} environment`,
  });
  
  new cdk.CfnOutput(stack, `LogsBucketArn-${stage}`, {
    value: bucket.bucketArn,
    exportName: `LogsBucketArn-${stage}`,
    description: `Centralized logs S3 bucket ARN for ${stage} environment`,
  });
  
  return bucket;
}
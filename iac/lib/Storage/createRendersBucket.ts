/**
 * Renders Output Bucket
 * 
 * Stores all try-on rendering outputs including previews, final photorealistic renders,
 * thumbnails, and processing status artifacts.
 * 
 * Prefixes:
 * - previews/<sessionId>/ - Initial 3D try-on previews (fast generation, expire sooner)
 * - final/<sessionId>/ - Final photorealistic renders from Replicate/Bedrock (long retention)
 * - thumbnails/<sessionId>/ - Compressed thumbnails for gallery views (web-optimized)
 * - animations/<sessionId>/ - Optional animated try-on sequences (premium feature)
 * - processing/<sessionId>/ - Intermediate processing artifacts (expire quickly)
 * - exports/<userId>/ - User-requested exports/downloads (expire after 30 days)
 * 
 * Security:
 * - Private bucket with signed URL access for authorized users
 * - S3-managed encryption (SSE-S3) 
 * - SSL-only access enforced
 * - Access logs to centralized logs bucket
 * - Potential CloudFront integration for delivery optimization
 * 
 * Lifecycle:
 * - Processing artifacts expire after 1 day
 * - Previews expire after 30 days (regeneratable quickly)
 * - Final renders transition to IA after 60 days, long retention
 * - Thumbnails follow same lifecycle as source renders
 * - User exports expire after 30 days
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export default function createRendersBucket(
  stack: cdk.Stack,
  stage: string,
  logsBucket?: s3.Bucket
) {
  const bucket = new s3.Bucket(stack, `RendersBucket-${stage}`, {
    bucketName: `garmaxai-renders-${stage.toLowerCase()}`,
    
    // Security: Private bucket with signed URL access
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    
    // Access logging to centralized logs bucket (if provided)
    ...(logsBucket && {
      serverAccessLogsBucket: logsBucket,
      serverAccessLogsPrefix: `s3/renders-${stage}/`,
    }),
    
    // CORS for potential direct browser access to signed URLs
    cors: [
      {
        allowedMethods: [
          s3.HttpMethods.GET,
          s3.HttpMethods.HEAD,
        ],
        allowedOrigins: ['*'], // TODO: Restrict to actual frontend domains
        allowedHeaders: ['Authorization', 'x-amz-date', 'x-amz-content-sha256'],
        exposedHeaders: ['ETag'],
        maxAge: 3600,
      },
    ],
    
    // Lifecycle rules for cost optimization
    lifecycleRules: [
      {
        // Processing artifacts expire quickly
        id: 'processing-cleanup',
        prefix: 'processing/',
        expiration: cdk.Duration.days(1),
        enabled: true,
      },
      {
        // Preview images expire after 30 days (regeneratable)
        id: 'previews-expiry',
        prefix: 'previews/',
        expiration: cdk.Duration.days(30),
        enabled: true,
      },
      {
        // Thumbnails follow same lifecycle as previews
        id: 'thumbnails-expiry',
        prefix: 'thumbnails/',
        expiration: cdk.Duration.days(30),
        enabled: true,
      },
      {
        // User exports expire after 30 days
        id: 'exports-expiry',
        prefix: 'exports/',
        expiration: cdk.Duration.days(30),
        enabled: true,
      },
      {
        // Final renders - long retention with IA transition
        id: 'final-renders-lifecycle',
        prefix: 'final/',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(60),
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(180),
          },
        ],
        // No automatic expiry for final renders (user content)
        enabled: true,
      },
      {
        // Animations - premium feature, longer retention
        id: 'animations-lifecycle',
        prefix: 'animations/',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30),
          },
        ],
        expiration: cdk.Duration.days(365), // 1 year retention
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
  new cdk.CfnOutput(stack, `RendersBucketName-${stage}`, {
    value: bucket.bucketName,
    exportName: `RendersBucketName-${stage}`,
    description: `Renders output S3 bucket name for ${stage} environment`,
  });
  
  new cdk.CfnOutput(stack, `RendersBucketArn-${stage}`, {
    value: bucket.bucketArn,
    exportName: `RendersBucketArn-${stage}`,
    description: `Renders output S3 bucket ARN for ${stage} environment`,
  });
  
  return bucket;
}
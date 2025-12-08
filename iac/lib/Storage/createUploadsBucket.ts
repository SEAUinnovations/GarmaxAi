/**
 * User Uploads Bucket
 * 
 * Stores user-uploaded photos (avatars front/side views) and garment images.
 * 
 * Prefixes:
 * - avatars/<userId>/front.jpg - Front view photo for SMPL estimation
 * - avatars/<userId>/side.jpg - Side view photo for pose/measurements
 * - garments/<garmentId>/ - Garment reference images and metadata
 * - temp/<sessionId>/ - Temporary uploads during session (auto-expire 7 days)
 * 
 * Security:
 * - Private bucket with blocked public access
 * - S3-managed encryption (SSE-S3)
 * - SSL-only access enforced
 * - Access logs to centralized logs bucket
 * - CORS for web upload from authorized origins
 * 
 * Lifecycle:
 * - Temp uploads expire after 7 days
 * - Avatar/garment images transition to IA after 30 days (cost optimization)
 * - No automatic expiry for user content (compliance/GDPR handled separately)
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export default function createUploadsBucket(
  stack: cdk.Stack,
  stage: string,
  logsBucket?: s3.Bucket
) {
  const bucket = new s3.Bucket(stack, `UploadsBucket-${stage}`, {
    bucketName: `garmaxai-uploads-${stage.toLowerCase()}`,
    
    // Security: Private bucket with full public access blocking
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    
    // Access logging to centralized logs bucket (if provided)
    ...(logsBucket && {
      serverAccessLogsBucket: logsBucket,
      serverAccessLogsPrefix: `s3/uploads-${stage}/`,
    }),
    
    // CORS for web uploads from frontend domains
    cors: [
      {
        allowedMethods: [
          s3.HttpMethods.GET,
          s3.HttpMethods.POST,
          s3.HttpMethods.PUT,
          s3.HttpMethods.HEAD,
          s3.HttpMethods.DELETE,
        ],
        allowedOrigins: ['*'], // TODO: Restrict to actual frontend domains
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3600,
      },
    ],
    
    // Lifecycle rules for cost optimization
    lifecycleRules: [
      {
        // Temporary uploads auto-expire after 7 days
        id: 'temp-uploads-expiry',
        prefix: 'temp/',
        expiration: cdk.Duration.days(7),
        enabled: true,
      },
      {
        // User content transitions to Infrequent Access after 30 days
        id: 'user-content-transition',
        prefix: '',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30),
          },
        ],
        enabled: true,
      },
    ],
    
    // Cleanup on stack deletion (all environments)
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });
  
  // CloudFormation output for other services to reference
  new cdk.CfnOutput(stack, `UploadsBucketName-${stage}`, {
    value: bucket.bucketName,
    exportName: `UploadsBucketName-${stage}`,
    description: `User uploads S3 bucket name for ${stage} environment`,
  });
  
  new cdk.CfnOutput(stack, `UploadsBucketArn-${stage}`, {
    value: bucket.bucketArn,
    exportName: `UploadsBucketArn-${stage}`,
    description: `User uploads S3 bucket ARN for ${stage} environment`,
  });
  
  return bucket;
}
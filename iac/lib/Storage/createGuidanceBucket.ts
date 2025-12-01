/**
 * Guidance Assets Bucket
 * 
 * Stores AI rendering guidance assets including depth maps, normal maps, pose keypoints,
 * segmentation masks, and style references generated from user photos and garments.
 * 
 * Prefixes:
 * - depth/<sessionId>/ - Depth maps from SMPL estimation for ControlNet Depth
 * - normals/<sessionId>/ - Normal maps from 3D mesh rendering for ControlNet Normal  
 * - poses/<sessionId>/ - 2D pose keypoints (OpenPose/MediaPipe format) for ControlNet Pose
 * - segments/<sessionId>/ - Segmentation masks (person, garment regions) for inpainting
 * - styles/<userId>/ - User style references and LoRA adaptations
 * - prompts/<sessionId>/ - Generated text prompts and negative prompts for diffusion
 * - controlnets/<sessionId>/ - Combined ControlNet conditioning images
 * 
 * Security:
 * - Private bucket - these are derived/computed assets, not user originals
 * - S3-managed encryption (SSE-S3)
 * - SSL-only access enforced
 * - Access logs to centralized logs bucket
 * - No CORS needed (backend-only access)
 * 
 * Lifecycle:
 * - Session guidance expires after 90 days (can be regenerated from uploads)
 * - User styles transition to IA after 30 days, expire after 1 year if unused
 * - Temp processing files expire after 1 day
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export default function createGuidanceBucket(
  stack: cdk.Stack,
  stage: string,
  logsBucket?: s3.Bucket
) {
  const bucket = new s3.Bucket(stack, `GuidanceBucket-${stage}`, {
    bucketName: `garmaxai-guidance-${stage.toLowerCase()}`,
    
    // Security: Private bucket - no public access needed
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    
    // Access logging to centralized logs bucket (if provided)
    ...(logsBucket && {
      serverAccessLogsBucket: logsBucket,
      serverAccessLogsPrefix: `s3/guidance-${stage}/`,
    }),
    
    // No CORS - backend services only
    
    // Lifecycle rules for cost optimization
    lifecycleRules: [
      {
        // Temporary processing files expire after 1 day
        id: 'temp-processing-expiry',
        prefix: 'temp/',
        expiration: cdk.Duration.days(1),
        enabled: true,
      },
      {
        // Session guidance assets expire after 90 days (regeneratable)
        id: 'session-guidance-expiry',
        expiration: cdk.Duration.days(90),
        enabled: true,
        // Apply to depth, normals, poses, segments, prompts, controlnets prefixes
      },
      {
        // User styles transition to IA, then expire if unused
        id: 'user-styles-lifecycle',
        prefix: 'styles/',
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
  new cdk.CfnOutput(stack, `GuidanceBucketName-${stage}`, {
    value: bucket.bucketName,
    exportName: `GuidanceBucketName-${stage}`,
    description: `AI guidance assets S3 bucket name for ${stage} environment`,
  });
  
  new cdk.CfnOutput(stack, `GuidanceBucketArn-${stage}`, {
    value: bucket.bucketArn,
    exportName: `GuidanceBucketArn-${stage}`,
    description: `AI guidance assets S3 bucket ARN for ${stage} environment`,
  });
  
  return bucket;
}
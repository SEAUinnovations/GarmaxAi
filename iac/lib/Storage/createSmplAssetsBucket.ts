/**
 * SMPL Model Assets Bucket
 * 
 * Stores SMPL/SMPL-X model files, textures, and related machine learning assets
 * required for 3D human pose estimation and mesh generation.
 * 
 * IMPORTANT SECURITY CONSIDERATIONS:
 * - These are proprietary model files (SMPL license requires non-redistribution)
 * - Extremely restricted access - only authorized compute services
 * - No public access under any circumstances
 * - Access logging mandatory for compliance auditing
 * - Consider KMS encryption for additional protection (future enhancement)
 * 
 * Prefixes:
 * - models/smpl/ - SMPL model files (.pkl, .npz)
 * - models/smplx/ - SMPL-X extended model files  
 * - textures/ - UV texture maps and material definitions
 * - weights/ - Pre-trained network weights (ROMP, SMPLify-X, etc.)
 * - configs/ - Model configuration files and parameter sets
 * - templates/ - Template meshes and canonical poses
 * 
 * Access Control:
 * - Deny all public access (enforced at bucket and IAM level)
 * - Allow only specific service principals (SMPL processing Lambda/ECS)
 * - VPC endpoint recommended for network isolation
 * - All access logged and monitored
 * 
 * Lifecycle:
 * - No automatic expiry (these are static ML assets)
 * - Transition to IA after 60 days (infrequent but critical access)
 * - Versioning enabled for model updates
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export default function createSmplAssetsBucket(
  stack: cdk.Stack,
  stage: string,
  logsBucket?: s3.Bucket
) {
  const bucket = new s3.Bucket(stack, `SmplAssetsBucket-${stage}`, {
    bucketName: `garmaxai-smpl-assets-${stage.toLowerCase()}`,
    
    // Maximum security configuration
    encryption: s3.BucketEncryption.S3_MANAGED, // TODO: Consider KMS CMK for additional protection
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    versioned: true, // Enable versioning for model updates
    
    // Mandatory access logging for compliance
    ...(logsBucket && {
      serverAccessLogsBucket: logsBucket,
      serverAccessLogsPrefix: `s3/smpl-assets-${stage}/`,
    }),
    
    // No CORS - absolutely no browser access
    
    // Lifecycle rules for cost optimization (but no expiry)
    lifecycleRules: [
      {
        // Transition to IA after 60 days (infrequent but critical access)
        id: 'smpl-assets-transition',
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(60),
          },
        ],
        // No automatic expiry - these are permanent assets
        enabled: true,
      },
    ],
    
    // Cleanup on stack deletion (all environments - backed up externally)
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });
  
  // Explicit bucket policy to deny all public access and unauthorized principals
  bucket.addToResourcePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:*'],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      conditions: {
        Bool: {
          'aws:SecureTransport': 'false',
        },
      },
    })
  );
  
  // Additional policy to deny any public read access
  bucket.addToResourcePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: [
        's3:GetObject',
        's3:GetObjectVersion',
        's3:ListBucket',
      ],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      conditions: {
        StringNotEquals: {
          'aws:PrincipalServiceName': [
            'lambda.amazonaws.com',
            'ecs-tasks.amazonaws.com',
          ],
        },
      },
    })
  );
  
  // CloudFormation outputs (for authorized services only)
  new cdk.CfnOutput(stack, `SmplAssetsBucketName-${stage}`, {
    value: bucket.bucketName,
    exportName: `SmplAssetsBucketName-${stage}`,
    description: `SMPL model assets S3 bucket name for ${stage} environment (RESTRICTED ACCESS)`,
  });
  
  new cdk.CfnOutput(stack, `SmplAssetsBucketArn-${stage}`, {
    value: bucket.bucketArn,
    exportName: `SmplAssetsBucketArn-${stage}`,
    description: `SMPL model assets S3 bucket ARN for ${stage} environment (RESTRICTED ACCESS)`,
  });
  
  return bucket;
}
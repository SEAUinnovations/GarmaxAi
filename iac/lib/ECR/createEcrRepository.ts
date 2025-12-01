import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Stack } from 'aws-cdk-lib';

/**
 * Creates ECR repository for SMPL processing container images
 * 
 * Purpose: Stores Docker images for heavy SMPL processing workloads that exceed Lambda limits
 * Features:
 * - Lifecycle policy to manage image retention and costs
 * - Vulnerability scanning enabled for security
 * - Image immutability for production deployments
 * - Cross-region replication for disaster recovery (optional)
 * 
 * Cost Considerations:
 * - $0.10 per GB-month for image storage
 * - Lifecycle policy keeps only last 10 images to control costs
 * - Vulnerability scanning included at no additional cost
 * 
 * @param stack - CDK Stack context
 * @param stage - Deployment stage (DEV, QA, PROD)
 * @returns ECR Repository instance
 */
export default function createEcrRepository(
  stack: Stack,
  stage: string,
): ecr.Repository {
  
  // Create ECR repository for SMPL processing images
  const smplProcessingRepo = new ecr.Repository(stack, `SmplProcessingRepo-${stage}`, {
    repositoryName: `garmax-ai/smpl-processor-${stage.toLowerCase()}`,
    
    // Enable image scanning for security vulnerabilities
    imageScanOnPush: true,
    
    // Enable image tag immutability for production stability
    imageTagMutability: stage === 'PROD' 
      ? ecr.TagMutability.IMMUTABLE 
      : ecr.TagMutability.MUTABLE,
    
    // Lifecycle policy to manage storage costs
    lifecycleRules: [
      {
        // Keep only the last 10 tagged images
        rulePriority: 1,
        description: 'Keep last 10 tagged images',
        tagStatus: ecr.TagStatus.TAGGED,
        maxImageCount: 10,
      },
      {
        // Delete untagged images after 1 day (cleanup failed builds)
        rulePriority: 2, 
        description: 'Delete untagged images after 1 day',
        tagStatus: ecr.TagStatus.UNTAGGED,
        maxImageAge: cdk.Duration.days(1),
      },
      {
        // Keep production images longer for rollback capability
        rulePriority: 3,
        description: 'Keep production images for 30 days',
        tagStatus: ecr.TagStatus.TAGGED,
        tagPrefixList: ['prod-', 'release-'],
        maxImageAge: stage === 'PROD' 
          ? cdk.Duration.days(30) 
          : cdk.Duration.days(7),
      }
    ],
    
    // Enable encryption at rest
    encryption: ecr.RepositoryEncryption.AES_256,
    
    // Remove repository when stack is deleted (for non-production)
    removalPolicy: stage === 'PROD' 
      ? cdk.RemovalPolicy.RETAIN 
      : cdk.RemovalPolicy.DESTROY,
  });
  
  // Add CloudFormation output for easy access
  new cdk.CfnOutput(stack, `SmplProcessingRepoUri-${stage}`, {
    value: smplProcessingRepo.repositoryUri,
    exportName: `SmplProcessingRepoUri-${stage}`,
    description: 'ECR Repository URI for SMPL processing container',
  });
  
  new cdk.CfnOutput(stack, `SmplProcessingRepoName-${stage}`, {
    value: smplProcessingRepo.repositoryName,
    exportName: `SmplProcessingRepoName-${stage}`,
    description: 'ECR Repository name for CI/CD pipeline reference',
  });
  
  return smplProcessingRepo;
}
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Stack } from 'aws-cdk-lib';
import { env } from '../../../../parameters/config';

/**
 * Creates a security group for ElastiCache (Redis) cluster
 * 
 * Allows:
 * - Inbound Redis traffic (port 6379) from Lambda security groups
 * - All outbound traffic
 * 
 * Lambda security groups will add ingress rules to this SG dynamically
 */
export default function createElastiCacheSecurityGroup(
  stack: Stack,
  vpc: ec2.IVpc
): ec2.SecurityGroup {
  const stage = env.STAGE;

  const elastiCacheSecurityGroup = new ec2.SecurityGroup(
    stack,
    `ElastiCache-SecurityGroup-${stage}`,
    {
      securityGroupName: `${stack.stackName}-ElastiCache-SG-${stage}`,
      vpc,
      description: 'Security group for ElastiCache Redis cluster',
      allowAllOutbound: true,
    }
  );

  // Ingress rules will be added by Lambda security group configuration
  // to allow access from specific Lambda functions

  return elastiCacheSecurityGroup;
}

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

  // Allow Redis connections from VPC private subnets (where Lambda functions run)
  // This avoids circular dependencies with BackendStack
  elastiCacheSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(6379),
    'Allow Redis access from VPC private subnets (Lambda functions)'
  );

  return elastiCacheSecurityGroup;
}

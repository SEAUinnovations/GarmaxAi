import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Stack } from 'aws-cdk-lib';
import { env } from '../../../../parameters/config';

/**
 * Creates a dedicated security group for Lambda processors
 * 
 * Allows:
 * - Egress to RDS (PostgreSQL port 5432)
 * - Egress to ElastiCache (Redis port 6379)
 * - Egress to VPC endpoints (HTTPS port 443)
 * - Egress to internet via NAT Gateway (HTTPS port 443 and all traffic)
 * 
 * Also configures:
 * - Ingress rules on RDS security group
 * - Ingress rules on ElastiCache security group
 * 
 * This isolates Lambda network access and enables fine-grained security controls
 */
export default function createLambdaProcessorSG(
  stack: Stack,
  vpc: ec2.IVpc,
  rdsSecurityGroup: ec2.ISecurityGroup,
  elastiCacheSecurityGroup: ec2.ISecurityGroup,
  vpcEndpointSecurityGroup: ec2.ISecurityGroup
): ec2.SecurityGroup {
  const stage = env.STAGE;

  // Create dedicated Lambda security group
  const lambdaProcessorSG = new ec2.SecurityGroup(
    stack,
    `LambdaProcessor-SecurityGroup-${stage}`,
    {
      securityGroupName: `${stack.stackName}-LambdaProcessor-SG-${stage}`,
      vpc,
      description: 'Security group for Lambda processor functions',
      allowAllOutbound: false, // We'll define specific egress rules
    }
  );

  // Egress Rules for Lambda Processors

  // 1. Allow outbound to RDS (PostgreSQL)
  lambdaProcessorSG.addEgressRule(
    rdsSecurityGroup,
    ec2.Port.tcp(5432),
    'Allow Lambda to connect to RDS PostgreSQL'
  );

  // 2. Allow outbound to ElastiCache (Redis)
  lambdaProcessorSG.addEgressRule(
    elastiCacheSecurityGroup,
    ec2.Port.tcp(6379),
    'Allow Lambda to connect to ElastiCache Redis'
  );

  // 3. Allow outbound to VPC endpoints (HTTPS)
  lambdaProcessorSG.addEgressRule(
    vpcEndpointSecurityGroup,
    ec2.Port.tcp(443),
    'Allow Lambda to access VPC endpoints (S3, Secrets Manager, SSM, EventBridge)'
  );

  // 4. Allow outbound HTTPS to internet via NAT Gateway (for external APIs like Replicate, Stripe, Bedrock)
  lambdaProcessorSG.addEgressRule(
    ec2.Peer.anyIpv4(),
    ec2.Port.tcp(443),
    'Allow Lambda to access external HTTPS APIs via NAT Gateway'
  );

  // 5. Allow outbound HTTP (some APIs might redirect or use HTTP)
  lambdaProcessorSG.addEgressRule(
    ec2.Peer.anyIpv4(),
    ec2.Port.tcp(80),
    'Allow Lambda to access external HTTP APIs via NAT Gateway'
  );

  // 6. Allow DNS resolution (UDP port 53)
  lambdaProcessorSG.addEgressRule(
    ec2.Peer.anyIpv4(),
    ec2.Port.udp(53),
    'Allow DNS resolution'
  );

  // Ingress Rules on Target Security Groups

  // Allow Lambda to connect to RDS
  (rdsSecurityGroup as ec2.SecurityGroup).addIngressRule(
    lambdaProcessorSG,
    ec2.Port.tcp(5432),
    'Allow Lambda processors to connect to RDS'
  );

  // Allow Lambda to connect to ElastiCache
  (elastiCacheSecurityGroup as ec2.SecurityGroup).addIngressRule(
    lambdaProcessorSG,
    ec2.Port.tcp(6379),
    'Allow Lambda processors to connect to ElastiCache Redis'
  );

  // VPC endpoint security group already allows all VPC CIDR, no additional rule needed

  return lambdaProcessorSG;
}

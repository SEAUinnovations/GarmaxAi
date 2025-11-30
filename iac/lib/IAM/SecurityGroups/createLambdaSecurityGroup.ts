import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { env } from '../../../../parameters/config'




export default function createLambdaSecurityGroup(
    stack: Stack,
    region: string,
    vpc:IVpc
) {
 
 
 // Define the Security Group
 const lambdaSecurityGroup = new cdk.aws_ec2.SecurityGroup(stack, 'LambdaSecurityGroup', {
    vpc,
    description: 'Security group for Lambda',
    allowAllOutbound: true, // This allows all outbound traffic by default
  });

  // Add ingress rule to allow HTTPS traffic
  lambdaSecurityGroup.addIngressRule(
    cdk.aws_ec2.Peer.anyIpv4(), // Allows traffic from any IPv4 address
    cdk.aws_ec2.Port.tcp(443),  // Allows traffic on port 443 (HTTPS)
    'Allow HTTPS traffic'
  );

  // (Optional) Add additional egress rules if required
  lambdaSecurityGroup.addEgressRule(
    cdk.aws_ec2.Peer.anyIpv4(), // Allows traffic to any IPv4 address
    cdk.aws_ec2.Port.allTraffic(), // Allows all outbound traffic
    'Allow all outbound traffic'
  );

  return lambdaSecurityGroup
}

import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { env } from '../../../../parameters/config'




export default function createFargateSecurityGroup(
    stack: Stack,
    region: string,
    vpc:IVpc
) {
    const stackName = stack.stackName;
    const stage = env.STAGE

		//Define SecurityGroups

		const secGroup_nlb = new cdk.aws_ec2.SecurityGroup(stack, `nlb-security-group-${stage}`, {
			securityGroupName: `${stackName}-nlb-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		  });
		  
		  const secGroup_service = new cdk.aws_ec2.SecurityGroup(stack, `fargate-security-group-${stage}`, {
			securityGroupName: `${stackName}-fargate-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		  });

		const vpcEndpointSecurityGroup = new cdk.aws_ec2.SecurityGroup(stack, `vpc-endpoint-security-group-${stage}`, {
			securityGroupName: `${stackName}-vpc-endpoint-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		});

		vpcEndpointSecurityGroup.addIngressRule(
			cdk.aws_ec2.Peer.anyIpv4(), // Allow traffic from any IPv4 address
			cdk.aws_ec2.Port.tcp(3000), // Allow TCP traffic on port 3000
			"Allow traffic on TCP port 3000 from anywhere" // Description of the rule
		  );
		  
		  // Allow traffic from the Fargate security group to the NLB security group
		  secGroup_nlb.addIngressRule(
			secGroup_service, // Source security group
			cdk.aws_ec2.Port.tcp(3000), // Port and protocol
			"Allow traffic from Fargate to NLB"
		  );

		  //Allow traffic from CF to NLB
		  secGroup_nlb.addIngressRule(
			cdk.aws_ec2.Peer.prefixList('pl-3b927c52'), // Source security group
			cdk.aws_ec2.Port.allTraffic(), // Port and protocol
			"Allow traffic from CF to NLB"
		  );
		  
		  // Allow traffic from the NLB security group to the Fargate security group
		  secGroup_service.addIngressRule(
			secGroup_nlb, // Source security group
			cdk.aws_ec2.Port.tcp(3000), // Port and protocol
			"Allow traffic from NLB to Fargate"
		  );
		  
		return [secGroup_service, secGroup_nlb, vpcEndpointSecurityGroup]
    }

import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { env } from '../../../../parameters/config'




export default function createVpcEndpointSecurityGroup(
    stack: Stack,
    region: string,
) {
    const stackName = stack.stackName;
    const stage = env.STAGE

    const vpc = cdk.aws_ec2.Vpc.fromLookup(stack, `${stackName}Vpc-SG-Association`, {
        vpcId: env.vpc[region].id,
    });
		//Define SecurityGroups
        const vpcEndpointSecurityGroup = new cdk.aws_ec2.SecurityGroup(stack, 'VPCEndpointSecurityGroup', {
            vpc,
            allowAllOutbound: true,
            description: 'Allow TLS for VPC Endpoint',
          });
      
          vpcEndpointSecurityGroup.addIngressRule(vpcEndpointSecurityGroup, cdk.aws_ec2.Port.tcp(443), 'Allows inbound traffic from the same security group');
      
    
        return vpcEndpointSecurityGroup
    }
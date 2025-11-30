import * as cdk from 'aws-cdk-lib';
import { env } from '../../../parameters/config'
import { SubnetType, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, GatewayVpcEndpoint, InterfaceVpcEndpoint, ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Stack } from 'aws-cdk-lib';


export default function createVpc(
    stack: Stack,
    region: string,
    // vpcEndpointSecurityGroup: ISecurityGroup
) {

    //Attach VPC
    const vpc = cdk.aws_ec2.Vpc.fromLookup(stack, `${stack.stackName}-Vpc`, {
        vpcId: env.vpc[region].id,
    })


  return vpc

}
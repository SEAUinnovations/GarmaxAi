import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';


export default function createVpc(
    stack: Stack,
    region: string,
    env: any,
) {

    // Import existing VPC by ID (no lookup required, avoids Early Validation errors)
    const vpc = cdk.aws_ec2.Vpc.fromVpcAttributes(stack, `${stack.stackName}-Vpc`, {
        vpcId: env.vpc[region].id,
        availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    })


  return vpc

}
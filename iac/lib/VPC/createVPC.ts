import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';


export default function createVpc(
    stack: Stack,
    region: string,
    env: any,
) {

    const vpc = cdk.aws_ec2.Vpc.fromLookup(stack, `${stack.stackName}-Vpc`, {
        vpcId: env.vpc[region].id,
    })


  return vpc

}
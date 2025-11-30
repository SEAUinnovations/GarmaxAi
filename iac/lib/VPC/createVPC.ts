import * as cdk from 'aws-cdk-lib';
import { env } from '../../../parameters/config'
import { Stack } from 'aws-cdk-lib';


export default function createVpc(
    stack: Stack,
    region: string,
) {

    //Attach VPC
    const vpc = cdk.aws_ec2.Vpc.fromLookup(stack, `${stack.stackName}-Vpc`, {
        vpcId: env.vpc[region].id,
    })


  return vpc

}
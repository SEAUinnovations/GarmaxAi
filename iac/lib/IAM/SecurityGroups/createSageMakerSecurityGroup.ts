
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { env } from '../../../../parameters/config'

export default function createSageMakerSecurityGroup(
    stack: Stack,
    region: string,
    vpc:IVpc
) {
    const stackName = stack.stackName;
    const stage = env.STAGE

		//Define SecurityGroups

		const secGroup_sagemaker = new cdk.aws_ec2.SecurityGroup(stack, `sagemaker-security-group-${stage}`, {
			securityGroupName: `sagemaker-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		})
		secGroup_sagemaker.addIngressRule(cdk.aws_ec2.Peer.ipv4('0.0.0.0/0'), cdk.aws_ec2.Port.tcp(443), "Allow NLB access to Fargate");
    
        return secGroup_sagemaker
    }
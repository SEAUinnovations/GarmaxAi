

import * as cdk from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { env } from '../../../../parameters/config';

export default function createDBecurityGroup(
	stack: cdk.Stack,
	region: string,
	vpc:IVpc
) {
    const stackName = stack.stackName;
    const stage = env.STAGE

		//Define SecurityGroups

		const createRDSSecurityGroup = new cdk.aws_ec2.SecurityGroup(stack, `RDS-security-group-${stage}`, {
			securityGroupName: `${stackName}-RDS-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		  });
		
		const createDynamoDB_SG = new cdk.aws_ec2.SecurityGroup(stack, `Dynamo-security-group-${stage}`, {
			securityGroupName: `${stackName}-Dynamo-security-group-${stage}`,
			vpc,
			allowAllOutbound: true,
		});
		  
		 
	 return [createRDSSecurityGroup, createDynamoDB_SG];
}


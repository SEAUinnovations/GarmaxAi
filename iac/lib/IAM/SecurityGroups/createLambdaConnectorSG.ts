
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { env } from '../../../../parameters/config'




export default function createLambdaConnectorSG(
    stack: Stack,
    region: string,
    vpc:IVpc
) {
    const stackName = stack.stackName;
    const stage = env.STAGE

		//Define SecurityGroups

		const secGroup_service = new cdk.aws_ec2.SecurityGroup(stack, `LambdaConnectorSG-${stage}`, {
			securityGroupName: `LambdaConnectorSG-${stage}`,
			vpc,
			allowAllOutbound: true,
		})
		secGroup_service.addIngressRule(cdk.aws_ec2.Peer.ipv4('0.0.0.0/0'), cdk.aws_ec2.Port.tcp(8515), "Allow NLB access to Fargate");
        
    
        // Allow inbound traffic from Lambda to the RDS instance on the port used by RDS (e.g., 5432 for PostgreSQL)
        secGroup_service.addEgressRule(
            cdk.aws_ec2.Peer.ipv4('0.0.0.0/0'), 
            cdk.aws_ec2.Port.tcp(5432), // Port number of your RDS instance
            "Allow Lambda access to RDS"
        );

        const rdsSecurityGroup = new cdk.aws_ec2.SecurityGroup(stack, 'RDSSecurityGroupConnector', {
            vpc,
            allowAllOutbound: true,
        });
        
        // Allow inbound traffic from the Lambda security group on the port used by RDS (e.g., 5432)
        rdsSecurityGroup.addIngressRule(
            secGroup_service,
            cdk.aws_ec2.Port.tcp(5432), // Port number of your RDS instance
            "Allow Lambda access to RDS"
        );
            


        return secGroup_service
    }
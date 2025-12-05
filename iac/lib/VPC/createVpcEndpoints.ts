import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcEndpointsConfig {
  s3Gateway: ec2.IGatewayVpcEndpoint;
  dynamoDbGateway: ec2.IGatewayVpcEndpoint;
  secretsManagerInterface: ec2.InterfaceVpcEndpoint;
  ssmInterface: ec2.InterfaceVpcEndpoint;
  eventBridgeInterface: ec2.InterfaceVpcEndpoint;
  endpointSecurityGroup: ec2.SecurityGroup;
}

/**
 * Creates VPC endpoints to reduce NAT Gateway costs
 * 
 * Gateway Endpoints (Free):
 * - S3: For bucket operations from Lambda
 * - DynamoDB: For table operations from Lambda
 * 
 * Interface Endpoints (~$7.20/month each):
 * - Secrets Manager: For API key retrieval
 * - SSM Parameter Store: For configuration parameters
 * - EventBridge: For event publishing
 * 
 * All interface endpoints have privateDnsEnabled: true for automatic routing
 * 
 * Cost savings: ~$60-150/month in NAT charges vs ~$36/month in endpoint fees
 */
export default function createVpcEndpoints(
  scope: Construct,
  stage: string,
  vpc: ec2.IVpc
): VpcEndpointsConfig {
  // Security group for VPC interface endpoints
  const endpointSecurityGroup = new ec2.SecurityGroup(
    scope,
    `VpcEndpoint-SecurityGroup-${stage}`,
    {
      securityGroupName: `${(scope as any).stackName}-VpcEndpoint-SG-${stage}`,
      vpc,
      description: 'Security group for VPC interface endpoints',
      allowAllOutbound: true,
    }
  );

  // Allow HTTPS inbound from VPC CIDR (for Lambda and other resources to reach endpoints)
  endpointSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(443),
    'Allow HTTPS from VPC resources to interface endpoints'
  );

  // Gateway Endpoints (Free - no hourly charges)
  
  // S3 Gateway Endpoint
  const s3Gateway = vpc.addGatewayEndpoint(`S3-GatewayEndpoint-${stage}`, {
    service: ec2.GatewayVpcEndpointAwsService.S3,
    subnets: [
      {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    ],
  });

  // DynamoDB Gateway Endpoint
  const dynamoDbGateway = vpc.addGatewayEndpoint(`DynamoDB-GatewayEndpoint-${stage}`, {
    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    subnets: [
      {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    ],
  });

  // Interface Endpoints (~$0.01/hour each = ~$7.20/month)
  // privateDnsEnabled: true allows Lambda to use standard AWS SDK without endpoint URLs
  
  // Secrets Manager Interface Endpoint
  const secretsManagerInterface = new ec2.InterfaceVpcEndpoint(
    scope,
    `SecretsManager-InterfaceEndpoint-${stage}`,
    {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [endpointSecurityGroup],
    }
  );

  // SSM Parameter Store Interface Endpoint
  const ssmInterface = new ec2.InterfaceVpcEndpoint(
    scope,
    `SSM-InterfaceEndpoint-${stage}`,
    {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      privateDnsEnabled: true,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [endpointSecurityGroup],
    }
  );

  // EventBridge Interface Endpoint
  const eventBridgeInterface = new ec2.InterfaceVpcEndpoint(
    scope,
    `EventBridge-InterfaceEndpoint-${stage}`,
    {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
      privateDnsEnabled: true,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [endpointSecurityGroup],
    }
  );

  // CloudFormation outputs for reference
  new cdk.CfnOutput(scope, `S3GatewayEndpointId-${stage}`, {
    value: s3Gateway.vpcEndpointId,
    description: `S3 Gateway Endpoint ID for ${stage}`,
    exportName: `VpcEndpoints-S3Gateway-${stage}`,
  });

  new cdk.CfnOutput(scope, `DynamoDbGatewayEndpointId-${stage}`, {
    value: dynamoDbGateway.vpcEndpointId,
    description: `DynamoDB Gateway Endpoint ID for ${stage}`,
    exportName: `VpcEndpoints-DynamoDbGateway-${stage}`,
  });

  new cdk.CfnOutput(scope, `SecretsManagerEndpointId-${stage}`, {
    value: secretsManagerInterface.vpcEndpointId,
    description: `Secrets Manager Interface Endpoint ID for ${stage}`,
    exportName: `VpcEndpoints-SecretsManager-${stage}`,
  });

  new cdk.CfnOutput(scope, `SsmEndpointId-${stage}`, {
    value: ssmInterface.vpcEndpointId,
    description: `SSM Interface Endpoint ID for ${stage}`,
    exportName: `VpcEndpoints-SSM-${stage}`,
  });

  new cdk.CfnOutput(scope, `EventBridgeEndpointId-${stage}`, {
    value: eventBridgeInterface.vpcEndpointId,
    description: `EventBridge Interface Endpoint ID for ${stage}`,
    exportName: `VpcEndpoints-EventBridge-${stage}`,
  });

  new cdk.CfnOutput(scope, `VpcEndpointSecurityGroupId-${stage}`, {
    value: endpointSecurityGroup.securityGroupId,
    description: `VPC Endpoint Security Group ID for ${stage}`,
    exportName: `VpcEndpoints-SecurityGroup-${stage}`,
  });

  return {
    s3Gateway,
    dynamoDbGateway,
    secretsManagerInterface,
    ssmInterface,
    eventBridgeInterface,
    endpointSecurityGroup,
  };
}

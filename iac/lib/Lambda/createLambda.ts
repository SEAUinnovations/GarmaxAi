import * as cdk from 'aws-cdk-lib';
import { Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

interface CreateLambdaProps {
  vpc?: ec2.IVpc;
  securityGroups?: ec2.ISecurityGroup[];
  vpcSubnets?: ec2.SubnetSelection;
  redisEndpoint?: string;
  redisPort?: string;
}

export default function createLambda(
  stack: cdk.Stack, 
  id = 'GarmaxApiLambda',
  props?: CreateLambdaProps
) {
  const { vpc, securityGroups, vpcSubnets, redisEndpoint, redisPort } = props || {};

  // Create execution role
  const role = new iam.Role(stack, `${id}-Role`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: `Execution role for ${id} Lambda`,
  });

  // Add basic Lambda execution policy
  role.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  );

  // Add VPC execution policy if VPC is configured
  if (vpc) {
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
  }

  // Environment variables
  const environment: { [key: string]: string } = {};
  if (redisEndpoint) environment.REDIS_ENDPOINT = redisEndpoint;
  if (redisPort) environment.REDIS_PORT = redisPort;

  const func = new lambda.Function(stack, id, {
    runtime: Runtime.FROM_IMAGE,
    handler: Handler.FROM_IMAGE,
    code: lambda.Code.fromAssetImage('../', {
      file: 'Dockerfile.api',
      exclude: ['iac/cdk.out', 'iac/node_modules', 'client/node_modules', 'node_modules', '.git'],
    }),
    timeout: cdk.Duration.seconds(90), // Increased for VPC cold starts
    memorySize: 256,
    role,
    vpc,
    securityGroups,
    vpcSubnets,
    environment: Object.keys(environment).length > 0 ? environment : undefined,
  });

  return func;
}

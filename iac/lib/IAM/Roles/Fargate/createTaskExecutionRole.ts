import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";


export default function createtaskExecutionRole(
    stack: Stack,
    region: string,
) {

const taskExecutionRole = new cdk.aws_iam.Role(stack, `taskExecutionRole-`, {
    assumedBy: new cdk.aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    description: "Role that the api task definitions use to run the api code",
});

taskExecutionRole.attachInlinePolicy(
    new cdk.aws_iam.Policy(stack, `ecsTaskDefinitionPolicy`, {
        statements: [
            new cdk.aws_iam.PolicyStatement({
                effect: cdk.aws_iam.Effect.ALLOW,
                resources: [
                    "*"
                ],
                actions: [
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "ecr:PutImage",
                    "ecr:InitiateLayerUpload",
                    "ecr:UploadLayerPart",
                    "ecr:CompleteLayerUpload",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                    "ssm:GetParameters",
                    "ssm:Describe",
                    "ssm:List",
                    "secretsmanager:GetSecretValue",
                    "kms:Decrypt",
                    "iam:PassRole"
                ],
            }),
        ],
    })
);

taskExecutionRole.addManagedPolicy({
    managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
});
taskExecutionRole.addManagedPolicy({
    managedPolicyArn: 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess',
});

return taskExecutionRole
}

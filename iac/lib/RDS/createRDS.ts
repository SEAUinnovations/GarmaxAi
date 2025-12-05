import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { aws_rds } from "aws-cdk-lib";
import { aws_ec2 } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";


export default function createRDS(
        stack: Stack,
        stage: string,
        RDS_SG: aws_ec2.SecurityGroup,
        vpc: aws_ec2.IVpc,
        ) {


    //Creates new RDS DB Cluster
    const dbClusterIdentifier = `garmaxai-db-cluster-${stage}`;    
    const RDScluster = new aws_rds.DatabaseCluster(stack, `GarmaxAi-DBCluster-${stage}`, {
        clusterIdentifier:dbClusterIdentifier,
        engine: aws_rds.DatabaseClusterEngine.auroraMysql({ version: aws_rds.AuroraMysqlEngineVersion.VER_3_04_0 }),
        writer: aws_rds.ClusterInstance.provisioned('writer', {
            instanceIdentifier:`garmaxai-db-writer-${stage}`,
            instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.T3, aws_ec2.InstanceSize.MICRO),
        }),
        removalPolicy:RemovalPolicy.RETAIN,
        vpc,
        securityGroups: [RDS_SG],
        credentials: aws_rds.Credentials.fromGeneratedSecret('dbadmin'),
    });



    return RDScluster;

}
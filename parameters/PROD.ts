export default {
	vpc: { "us-east-1": { id: "vpc-0410b9fefa55a32bc" }, "us-west-2": { id: "vpc-0410b9fefa55a32bc" } },
    S3_BUCKET: 'PLACEHOLDER_S3_BUCKET',
    TEMP_BUCKET: "",
    AcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/afaf817e-cc40-49d6-9d67-c877b5a008ad" },
        "us-west-2": { id: "PLACEHOLDER_ACM_ARN" }
    },
    certificateid: {
        "us-east-1": { id: "afaf817e-cc40-49d6-9d67-c877b5a008ad" },
        "us-west-2": { id: "PLACEHOLDER_CERT_ID" }
    },
    ecrname: { "us-east-1": { name: "garmaxecr" }, "us-west-2": { name: "PLACEHOLDER_ECR" } },
    hostedZoneName: "garmaxai.com",
    hostedZoneId: "Z0952422X7N8XGE03LGF",
    frontendDomainName: "garmaxai.com",
    backendDomainName: "be.garmaxai.com",
    backendHostedZoneName: "be.garmaxai.com",
    backendHostedZoneId: "Z08611999E09WZ1ZC4I6",
    BackendAcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/96084e2a-58d6-4fb0-ba50-0572de11af2c" },
        "us-west-2": { id: "PLACEHOLDER_BACKEND_ACM_ARN" }
    },
    useCnameForBackend: false,
    TaskDefName: "GarmaxAi-TaskDef-prod",
    ServiceName: { "us-east-1": { id1: 'GarmaxAi-Service-prod' }, "us-west-2": { id1: 'GarmaxAi-Service-prod' } },
    clusterinfo: {
        "us-east-1": { name: "GarmaxAi-Cluster-prod", memory: 3072, minCapacity: 1, maxCapacity: 6, cpu: 512 },
        "us-west-2": { name: "GarmaxAi-Cluster-prod", memory: 3072, minCapacity: 1, maxCapacity: 6, cpu: 512 },
    },
    ApiName: { "us-east-1": { id: "GarmaxAi-Api-prod" }, "us-west-2": { id: "GarmaxAi-Api-prod" } },
    Fargateclustername: "GarmaxAi-Fargate-prod",
    FargateContainerName: "GarmaxAi-Container-prod",
    NetworkloadBalancerName: "GarmaxAi-NLB-prod",
    awsAccountNumber: "920792187297",
    APP_ID: "PLACEHOLDER_LAMBDA_ARN",
    STAGE: "PROD",
    LOG_LEVEL: 'info',
    wafArn: "PLACEHOLDER_WAF_ARN",
    latestContainerTag: "latest",
}
export default {
	vpc: {
		"us-east-1": { id: "PLACEHOLDER_VPC_ID" },
		"us-west-2": { id: "PLACEHOLDER_VPC_ID" },
	},
    S3_BUCKET: 'PLACEHOLDER_S3_BUCKET',
    TEMP_BUCKET: "",
    AcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/dde30665-1000-4339-b9f9-0a6cb7a2c50b" },
        "us-west-2": { id: "PLACEHOLDER_ACM_ARN" }
    },
    certificateid: {
        "us-east-1": { id: "dde30665-1000-4339-b9f9-0a6cb7a2c50b" },
        "us-west-2": { id: "PLACEHOLDER_CERT_ID" }
    },
    ecrname: { "us-east-1": { name: "garmaxecr" }, "us-west-2": { name: "PLACEHOLDER_ECR" } },
    hostedZoneName: "dev.garmaxai.com",
    hostedZoneId: "Z06873083I0TPIA6OYKFU",
    frontendDomainName: "dev.garmaxai.com",
    backendDomainName: "dev-be.garmaxai.com",
    backendHostedZoneName: "dev-be.garmaxai.com",
    backendHostedZoneId: "Z00980062M5GU0CFDETWQ",
    BackendAcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/0c9f01c3-14b6-4f2b-b2ef-6145835fe167" },
        "us-west-2": { id: "PLACEHOLDER_BACKEND_ACM_ARN" }
    },
    useCnameForBackend: false,
    TaskDefName: "PLACEHOLDER_TASKDEF",
    ServiceName: {
        "us-east-1": { id1: 'PLACEHOLDER_SERVICE' },
        "us-west-2": { id1: 'PLACEHOLDER_SERVICE' }
    },
    clusterinfo: {
        "us-east-1": {
            name: "PLACEHOLDER_CLUSTER",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
        },
        "us-west-2": {
            name: "PLACEHOLDER_CLUSTER",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
        },
    },
    ApiName: { "us-east-1": { id: "PLACEHOLDER_API" }, "us-west-2": { id: "PLACEHOLDER_API" } },
    Fargateclustername: "PLACEHOLDER_FARGATE_CLUSTER",
    FargateContainerName: "PLACEHOLDER_FARGATE_CONTAINER",
    NetworkloadBalancerName: "PLACEHOLDER_NLB",
    awsAccountNumber: "920792187297",
    APP_ID: "PLACEHOLDER_LAMBDA_ARN",
    STAGE: "DEV",
    LOG_LEVEL: 'info',
    wafArn: "PLACEHOLDER_WAF_ARN",
    latestContainerTag: "latest",
}
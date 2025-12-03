export default {
	vpc: {
		"us-east-1": { id: "vpc-00164c10786d24836" },
		"us-west-2": { id: "vpc-00164c10786d24836" },
	},
    S3_BUCKET: 'PLACEHOLDER_S3_BUCKET',
    TEMP_BUCKET: "",
    AcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/8b4e5879-bdfd-4975-b69d-55942368b906" },
        "us-west-2": { id: "PLACEHOLDER_ACM_ARN" }
    },
    certificateid: {
        "us-east-1": { id: "8b4e5879-bdfd-4975-b69d-55942368b906" },
        "us-west-2": { id: "PLACEHOLDER_CERT_ID" }
    },
    ecrname: { "us-east-1": { name: "garmaxecr" }, "us-west-2": { name: "PLACEHOLDER_ECR" } },
    hostedZoneName: "qa.garmaxai.com",
    hostedZoneId: "PLACEHOLDER_QA_HOSTED_ZONE_ID",
    frontendDomainName: "qa.garmaxai.com",
    backendDomainName: "qa-be.garmaxai.com",
    backendHostedZoneName: "qa-be.garmaxai.com",
    backendHostedZoneId: "Z08617541QAW22A1V5U0J",
    BackendAcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:920792187297:certificate/a84cac98-408d-4640-bddc-d8662bc4ca38" },
        "us-west-2": { id: "PLACEHOLDER_BACKEND_ACM_ARN" }
    },
    useCnameForBackend: false,
    TaskDefName: "GarmaxAi-TaskDef-qa",
    ServiceName: {
        "us-east-1": { id1: 'GarmaxAi-Service-qa' },
        "us-west-2": { id1: 'GarmaxAi-Service-qa' }
    },
    clusterinfo: {
        "us-east-1": {
            name: "GarmaxAi-Cluster-qa",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
        },
        "us-west-2": {
            name: "GarmaxAi-Cluster-qa",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
        },
    },
    ApiName: { "us-east-1": { id: "GarmaxAi-Api-qa" }, "us-west-2": { id: "GarmaxAi-Api-qa" } },
    Fargateclustername: "GarmaxAi-Fargate-qa",
    FargateContainerName: "GarmaxAi-Container-qa",
    NetworkloadBalancerName: "GarmaxAi-NLB-qa",
    awsAccountNumber: "920792187297",
    APP_ID: "PLACEHOLDER_LAMBDA_ARN",
    STAGE: "QA",
    LOG_LEVEL: 'info',
    wafArn: "PLACEHOLDER_WAF_ARN",
}
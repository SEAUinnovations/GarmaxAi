export default {
	vpc: { "us-east-1": { id: "PLACEHOLDER_VPC_ID" }, "us-west-2": { id: "PLACEHOLDER_VPC_ID" } },
    awsAccountNumber: "PLACEHOLDER_AWS_ACCOUNT",
    STAGE: "QA",
    LOG_LEVEL: 'info',
    latestContainerTag: "latest",
    wafArn: "PLACEHOLDER_WAF_ARN",
    frontendDomainName: "PLACEHOLDER_HOSTED_ZONE",
    backendDomainName: "backend.PLACEHOLDER_HOSTED_ZONE",
    backendHostedZoneName: "PLACEHOLDER_HOSTED_ZONE",
    backendHostedZoneId: "PLACEHOLDER_HOSTED_ZONE_ID",
    BackendAcmCert: {
        "us-east-1": { id: "PLACEHOLDER_BACKEND_ACM_ARN" },
        "us-west-2": { id: "PLACEHOLDER_BACKEND_ACM_ARN" }
    },
    useCnameForBackend: false,
}
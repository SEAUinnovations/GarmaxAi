"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    vpc: {
        "us-east-1": {
            id: "vpc-0f0839edc42b0209c",
        },
        "us-west-2": {
            id: "vpc-054e8eeffe2542fa0",
        },
    },
    S3_BUCKET: 'testvideobucket-seau',
    TEMP_BUCKET: "",
    AcmCert: {
        "us-east-1": { id: "arn:aws:acm:us-east-1:888577037035:certificate/c01ee62a-d7fe-4bfa-83a8-ff21c9a58d9d" },
        "us-west-2": { id: "PLACEHOLDERS" }
    },
    certificateid: {
        "us-east-1": { id: "c01ee62a-d7fe-4bfa-83a8-ff21c9a58d9d" },
        "us-west-2": { id: "PLACEHOLDERS" }
    },
    ecrname: { "us-east-1": { name: "seaubackend-prod" }, "us-west-2": { name: "seaubackend-prod-w" } },
    hostedZoneName: "garmaxai.com",
    hostedZoneId: "Z0952422X7N8XGE03LGF",
    TaskDefName: "seau-prod-TaskDef",
    ServiceName: {
        "us-east-1": {
            id1: 'SEAU-Fargate-EAST',
        },
        "us-west-2": {
            id1: 'SEAU-Fargate-WEST',
        }
    },
    clusterinfo: {
        "us-east-1": {
            name: "SEAU_EastCluster",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
            subnetId: "subnet-01e5d3a3980aff873",
            availabilityZone: "use1-az2",
            routeTableId: "rtb-0a3db7396eb6378ed",
            subnetId2: "subnet-073015e156e367471",
            availabilityZone2: "use1-az4",
            routeTableId2: "rtb-053557a510530a487",
        },
        "us-west-2": {
            name: "SEAU_WestCluster",
            memory: 3072,
            minCapacity: 1,
            maxCapacity: 6,
            cpu: 512,
            // subnetId: "subnet-073015e156e367471",
            // availabilityZone: "use1-az4",
            // routeTableId: "rtb-053557a510530a487",
        },
    },
    ApiName: {
        "us-east-1": { id: "SEAU-API-East" },
        "us-west-2": { id: "SEAU-API-West" }
    },
    Fargateclustername: "SEAUCluster-PROD",
    FargateContainerName: "SEAUContainer-PROD",
    NetworkloadBalancerName: "SEAUNLB",
    awsAccountNumber: "671534040701",
    APP_ID: "arn:aws:lambda:us-east-1:671534040701:function:postgresqlconnector",
    STAGE: "PROD",
    LOG_LEVEL: 'info',
    wafArn: "PLACEHOLDER40",
    // Generated build artifact — removed by maintainer. Replace with runtime import from TypeScript sources.
    module.exports = {};
export const env: {
  hostedZoneName: string;
  hostedZoneId: string;
  AcmCert: { [region: string]: { id: string } };
  certificateid: { [region: string]: { id: string } };
  vpc: { [region: string]: { id: string } };
  STAGE: string;
  environmentVariables_1: { secrets_1: { snapshotARN: string; generatePassword: boolean; [k: string]: any } };
  [k: string]: any;
} = {
  // Placeholders — replace with your environment values
  hostedZoneName: 'PLACEHOLDER_HOSTED_ZONE',
  hostedZoneId: 'PLACEHOLDER_HOSTED_ZONE_ID',
  AcmCert: {
    'us-east-1': { id: 'PLACEHOLDER_ACM_ARN' },
    'us-west-2': { id: 'PLACEHOLDER_ACM_ARN' },
  },
  certificateid: {
    'us-east-1': { id: 'PLACEHOLDER_CERT_ID' },
    'us-west-2': { id: 'PLACEHOLDER_CERT_ID' },
  },
  vpc: {
    'us-east-1': { id: 'PLACEHOLDER_VPC_ID' },
    'us-west-2': { id: 'PLACEHOLDER_VPC_ID' },
  },
  STAGE: 'PLACEHOLDER_STAGE',
  environmentVariables_1: {
    secrets_1: {
      snapshotARN: 'PLACEHOLDER_SNAPSHOT_ARN',
      generatePassword: false,
    },
  },
};

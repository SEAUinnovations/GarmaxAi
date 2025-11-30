import * as cdk from 'aws-cdk-lib';
import { env } from '../../../parameters/config'


export default function createCertificate(
    stack: cdk.Stack,
    region: string,
) {

        const arn = env.AcmCert[region].id;
		const certid = env.certificateid[region].id
		const certificate = cdk.aws_certificatemanager.Certificate.fromCertificateArn(stack, certid, arn);

        
        return certificate
}
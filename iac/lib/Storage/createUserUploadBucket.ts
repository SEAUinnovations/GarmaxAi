import * as cdk from 'aws-cdk-lib';
import {Stack} from 'aws-cdk-lib';

export default function createS3Bucket(
    stack: Stack,
    stage: string,
) {

    const S3Bucket = new cdk.aws_s3.Bucket(stack, `ModelMe${stage}`, {
        bucketName:`modelmebucketupload_${stage}`,
        removalPolicy:cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
        cors: [{
          allowedHeaders: ['*'],
          allowedMethods: [
            cdk.aws_s3.HttpMethods.POST,
            cdk.aws_s3.HttpMethods.PUT,
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.HEAD,
            cdk.aws_s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-delete-marker',
            'x-amz-id-2',
            'x-amz-request-id',
            'x-amz-server-side-encryption',
            'x-amz-version-id'
          ]
        }],
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED
      });
      
return S3Bucket

}
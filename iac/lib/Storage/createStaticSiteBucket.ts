import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';

export default function createStaticSiteBucket(
  stack: Stack,
  idSuffix: string,
) {
  const bucket = new cdk.aws_s3.Bucket(stack, `GarmaxSiteBucket-${idSuffix}` , {
    encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    autoDeleteObjects: false,
    cors: [
      {
        allowedMethods: [
          cdk.aws_s3.HttpMethods.GET,
          cdk.aws_s3.HttpMethods.HEAD,
        ],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 86400,
      },
    ],
  });

  return bucket;
}

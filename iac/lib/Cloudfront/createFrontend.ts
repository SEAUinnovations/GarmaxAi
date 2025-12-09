import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Duration, Stack } from 'aws-cdk-lib';
import { env } from '../../../parameters/config';

export interface FrontendDistributionProps {
  region: string;
  domainName: string; // frontend domain (e.g., app.example.com)
  wafArn?: string; // optional existing WAF web ACL ARN
}

export default function createFrontend(
  stack: Stack,
  stage: string,
  bucket: s3.IBucket,
  props: FrontendDistributionProps,
) {
  const { region, domainName, wafArn } = props;

  // Only create certificate and use custom domain if not using placeholder values
  let certificate: certificatemanager.ICertificate | undefined;
  let domainNames: string[] | undefined;
  
  if (!env.AcmCert[region].id.includes('PLACEHOLDER') && !domainName.includes('PLACEHOLDER')) {
    certificate = certificatemanager.Certificate.fromCertificateArn(
      stack,
      `FrontendCertificate-${stage}`,
      env.AcmCert[region].id,
    );
    domainNames = [domainName];
  }

  // Use OAC (Origin Access Control) for private S3 origin access - modern replacement for OAI
  const oac = new cloudfront.S3OriginAccessControl(stack, `FrontendOAC-${stage}`, {
    signing: cloudfront.Signing.SIGV4_ALWAYS,
  });

  const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket, {
    originAccessControl: oac,
  });

  // Response headers policy for CORS and security headers
  const headersPolicy = new cloudfront.ResponseHeadersPolicy(
    stack,
    `FrontendHeaders-${stage}`,
    {
      comment: 'CORS and security headers for SPA assets',
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowOrigins: [`https://${domainName}`],
        accessControlExposeHeaders: ['ETag'],
        accessControlMaxAge: Duration.days(1),
        originOverride: true,
      },
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:;",
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
      },
    },
  );

  const distribution = new cloudfront.Distribution(stack, `FrontendDistribution-${stage}` , {
    defaultBehavior: {
      origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy: headersPolicy,
    },
    defaultRootObject: 'index.html',
    certificate,
    domainNames,
    webAclId: wafArn && !wafArn.includes('PLACEHOLDER') ? wafArn : undefined,
    enableIpv6: true,
    enableLogging: false,
    errorResponses: [
      { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
      { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
    ],
  });

  // NOTE: Bucket policy for OAC cannot be added here to avoid circular dependency
  // (bucket in SharedInfraStack, distribution in FrontendStack)
  // The bucket policy must be added manually after initial deployment or via update script
  // See scripts/update-oac-bucket-policy.sh for automated solution

  // DNS Alias record to CloudFront (only if custom domain is configured)
  if (certificate && domainNames) {
    try {
      const hostedZone = route53.HostedZone.fromLookup(stack, `FrontendHostedZone-${stage}`, {
        domainName: env.hostedZoneName,
      });
      new route53.ARecord(stack, `FrontendAliasRecord-${stage}`, {
        recordName: domainName,
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
        ttl: Duration.minutes(5),
      });
    } catch (_e) {
      // If zone lookup fails during synth, skip record creation
    }
  }

  return distribution;
}

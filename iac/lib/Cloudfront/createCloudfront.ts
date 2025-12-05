import { INetworkLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { env } from "../../../parameters/config";
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// WAF may or may not be present in this codebase. Attempt to require it at runtime.
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

export default function createCloudfront(
  stack: Stack,
  stage: string,
  region: string,
  NLB?: INetworkLoadBalancer,
  apiDomain?: string,
  originPath?: string,
 ) {

// Optionally use WAF if available; skip if not configured
let WAF: { attrArn?: string } | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createWAF = require('../WAF/createWAF').default;
  WAF = createWAF(stack, stage);
} catch (e) {
  WAF = undefined;
}

    
// Reference backend SSL certificate for HTTPS (use backend-specific cert if provided)
// Skip certificate and custom domain if using placeholder values
let certificate: certificatemanager.ICertificate | undefined;
let distributionDomain: string | undefined;

if (!env.hostedZoneName.includes('PLACEHOLDER')) {
  const backendCertArn = (env.BackendAcmCert && env.BackendAcmCert[region]?.id)
    ? env.BackendAcmCert[region].id
    : env.AcmCert[region].id;
  
  if (!backendCertArn.includes('PLACEHOLDER')) {
    certificate = certificatemanager.Certificate.fromCertificateArn(stack, 'CloudfrontCert', backendCertArn);
  }
  
  distributionDomain = (env as any).backendDomainName
    ? (env as any).backendDomainName
    : `backend.${env.hostedZoneName}`;
}

    // Create a CloudFront distribution. If `apiDomain` is provided, use it as an HTTP origin
    const origin = apiDomain
      ? new origins.HttpOrigin(apiDomain)
      : origins.VpcOrigin.withNetworkLoadBalancer(NLB as INetworkLoadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(60),
          keepaliveTimeout: Duration.seconds(60),
        });

    const Distribution = new cloudfront.Distribution(stack, `GarmaxAi_CloudFrontDistribution-${stage}`, {
      defaultBehavior: {
        origin: origin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
      enabled: true,
      enableIpv6: true,
      webAclId: ((env as any).wafArn && !(env as any).wafArn.includes('PLACEHOLDER')) ? (env as any).wafArn : (WAF?.attrArn || undefined),
      domainNames: distributionDomain ? [distributionDomain] : undefined,
      certificate: certificate,
    });

    // Create or reference a Route53 hosted zone and add a DNS record (Alias A or CNAME) to CloudFront
    // Only if custom domain is configured
    if (distributionDomain && certificate) {
      try {
        const zoneName = (env as any).backendHostedZoneName || env.hostedZoneName;
        const hostedZone = route53.HostedZone.fromLookup(stack, 'GarmaxAiHostedZone', { domainName: zoneName });

      if ((env as any).useCnameForBackend) {
        new route53.CnameRecord(stack, `GarmaxAiCloudFrontCname-${stage}`, {
          recordName: distributionDomain,
          zone: hostedZone,
          domainName: Distribution.distributionDomainName,
          ttl: Duration.minutes(5),
        });
      } else {
        new route53.ARecord(stack, `GarmaxAiCloudFrontAlias-${stage}`, {
          recordName: distributionDomain,
          zone: hostedZone,
          target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(Distribution)),
          ttl: Duration.minutes(5),
        });
      }
      } catch (e) {
        // If hosted zone lookup fails during synth, skip creating record. create manually.
      }
    }


return Distribution

}
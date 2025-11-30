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

    
// Reference your SSL certificate for HTTPS
const certificate = certificatemanager.Certificate.fromCertificateArn(stack, 'CloudfrontCert', env.AcmCert[region].id);

    // Create a CloudFront distribution. If `apiDomain` is provided, use it as an HTTP origin
    const origin = apiDomain
      ? new origins.HttpOrigin(apiDomain, { originPath: originPath ?? '' })
      : origins.VpcOrigin.withNetworkLoadBalancer(NLB as INetworkLoadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(60),
          keepaliveTimeout: Duration.seconds(60),
        });

    const Distribution = new cloudfront.Distribution(stack, `ModelMe_CloudFrontDistribution-${stage}`, {
      defaultBehavior: {
        origin: origin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
      enabled: true,
      enableIpv6: true,
      webAclId: WAF?.attrArn,
      domainNames: [`${env.hostedZoneName}`],
      certificate: certificate,
    });

    // Create or reference a Route53 hosted zone and add an A record alias to CloudFront
    try {
      const hostedZone = route53.HostedZone.fromLookup(stack, 'ModelMeHostedZone', { domainName: env.hostedZoneName });
      new route53.ARecord(stack, `ModelMeCloudFrontAlias-${stage}`, {
        recordName: env.hostedZoneName,
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(Distribution)),
        ttl: Duration.minutes(5),
      });
    } catch (e) {
      // If hosted zone lookup fails during synth, skip creating record. User can create manually.
    }


return Distribution

}
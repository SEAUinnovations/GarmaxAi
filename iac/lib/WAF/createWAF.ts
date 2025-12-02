import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export function createWAF(scope: Construct, stage: string): wafv2.CfnWebACL {
  // Web ACL for CloudFront (must be in us-east-1)
  const webAcl = new wafv2.CfnWebACL(scope, `WebACL-${stage}`, {
    name: `garmaxai-waf-${stage.toLowerCase()}`,
    scope: 'CLOUDFRONT', // For CloudFront distributions
    defaultAction: { allow: {} },
    description: `WAF protection for GarmaxAI ${stage} environment`,
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: `garmaxai-waf-${stage.toLowerCase()}`,
    },
    rules: [
      // AWS Managed Rule: Common Rule Set (OWASP Top 10)
      {
        name: 'AWSManagedRulesCommonRuleSet',
        priority: 1,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'CommonRuleSet',
        },
      },
      // AWS Managed Rule: Known Bad Inputs
      {
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
        priority: 2,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'KnownBadInputs',
        },
      },
      // Rate limiting: 100 requests per 5 minutes per IP
      {
        name: 'RateLimitRule',
        priority: 3,
        statement: {
          rateBasedStatement: {
            limit: 100,
            aggregateKeyType: 'IP',
          },
        },
        action: {
          block: {
            customResponse: {
              responseCode: 429,
              customResponseBodyKey: 'rate-limit-response',
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'RateLimit',
        },
      },
      // Geo-blocking (optional - can be enabled per stage)
      ...(stage === 'PROD'
        ? [
            {
              name: 'GeoBlockingRule',
              priority: 4,
              statement: {
                geoMatchStatement: {
                  countryCodes: ['CN', 'RU', 'KP'], 
                },
              },
              action: { block: {} },
              visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'GeoBlocking',
              },
            },
          ]
        : []),
    ],
    customResponseBodies: {
      'rate-limit-response': {
        contentType: 'APPLICATION_JSON',
        content: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
        }),
      },
    },
    tags: [
      { key: 'Environment', value: stage },
      { key: 'CostCenter', value: 'Security' },
      { key: 'Purpose', value: 'WebApplicationFirewall' },
    ],
  });

  // Regional Web ACL for API Gateway (regional scope)
  const regionalWebAcl = new wafv2.CfnWebACL(
    scope,
    `RegionalWebACL-${stage}`,
    {
      name: `garmaxai-waf-regional-${stage.toLowerCase()}`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: `Regional WAF protection for GarmaxAI API Gateway ${stage}`,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `garmaxai-waf-regional-${stage.toLowerCase()}`,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
          },
        },
        {
          name: 'RateLimitRule',
          priority: 2,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
          },
        },
      ],
      tags: [
        { key: 'Environment', value: stage },
        { key: 'CostCenter', value: 'Security' },
        { key: 'Purpose', value: 'APIProtection' },
      ],
    }
  );

  // Outputs
  new cdk.CfnOutput(scope, `WAFWebACLArn-${stage}`, {
    value: webAcl.attrArn,
    description: `WAF Web ACL ARN for CloudFront ${stage}`,
    exportName: `GarmaxAI-WAFWebACLArn-${stage}`,
  });

  new cdk.CfnOutput(scope, `WAFRegionalWebACLArn-${stage}`, {
    value: regionalWebAcl.attrArn,
    description: `Regional WAF Web ACL ARN for API Gateway ${stage}`,
    exportName: `GarmaxAI-WAFRegionalWebACLArn-${stage}`,
  });

  return webAcl;
}

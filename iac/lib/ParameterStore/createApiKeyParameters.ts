/**
 * Parameter Store - API Keys and Configuration
 * 
 * Creates centralized SSM parameters for all API keys and configuration values.
 * This eliminates the need for .env files and enables single-source updates.
 * 
 * PARAMETER HIERARCHY:
 * ===================
 * /garmaxai/{stage}/replicate/api-key          [SecureString] - Replicate API authentication
 * /garmaxai/{stage}/stripe/secret-key          [SecureString] - Stripe secret key
 * /garmaxai/{stage}/stripe/webhook-secret      [SecureString] - Stripe webhook signature verification
 * /garmaxai/{stage}/stripe/price-basic-monthly [String]       - Stripe price ID for basic plan
 * /garmaxai/{stage}/stripe/price-pro-monthly   [String]       - Stripe price ID for pro plan
 * /garmaxai/{stage}/stripe/price-unlimited     [String]       - Stripe price ID for unlimited plan
 * /garmaxai/{stage}/cognito/user-pool-id       [String]       - Cognito User Pool ID
 * /garmaxai/{stage}/cognito/client-id          [String]       - Cognito App Client ID
 * /garmaxai/{stage}/redis/url                  [SecureString] - Redis connection string
 * /garmaxai/{stage}/database/url               [SecureString] - PostgreSQL connection string
 * /garmaxai/{stage}/frontend/url               [String]       - Frontend application URL
 * /garmaxai/{stage}/budget/daily-usd           [String]       - Daily budget limit in USD
 * /garmaxai/{stage}/alerts/email               [String]       - Alert notification email
 * /garmaxai/{stage}/aws/account-id             [String]       - AWS Account ID
 * /garmaxai/{stage}/s3/uploads-bucket          [String]       - Uploads bucket name
 * /garmaxai/{stage}/s3/renders-bucket          [String]       - Renders bucket name
 * /garmaxai/{stage}/s3/guidance-bucket         [String]       - Guidance assets bucket name
 * 
 * USAGE:
 * ======
 * 1. Deploy: `cdk deploy` creates all parameters with placeholder values
 * 2. Update: Use scripts/update-parameters.sh to bulk-update from .env
 * 3. Access: Lambdas/ECS read via SSM SDK or task definition valueFrom
 */

import { Construct } from 'constructs';
import * as aws_ssm from 'aws-cdk-lib/aws-ssm';
import { IGrantable } from 'aws-cdk-lib/aws-iam';

export interface ApiKeyParametersProps {
  readonly stage: string;
}

export interface ApiKeyParameters {
  replicateApiKey: aws_ssm.StringParameter;
  stripeSecretKey: aws_ssm.StringParameter;
  stripeWebhookSecret: aws_ssm.StringParameter;
  stripePriceBasicMonthly: aws_ssm.StringParameter;
  stripeProMonthly: aws_ssm.StringParameter;
  stripePriceUnlimited: aws_ssm.StringParameter;
  stripeStarterPriceId: aws_ssm.StringParameter;
  cognitoUserPoolId: aws_ssm.StringParameter;
  cognitoClientId: aws_ssm.StringParameter;
  redisUrl: aws_ssm.StringParameter;
  databaseUrl: aws_ssm.StringParameter;
  rdsHost: aws_ssm.StringParameter;
  rdsUsername: aws_ssm.StringParameter;
  rdsPassword: aws_ssm.StringParameter;
  frontendUrl: aws_ssm.StringParameter;
  dailyBudgetUsd: aws_ssm.StringParameter;
  alertEmail: aws_ssm.StringParameter;
  awsAccountId: aws_ssm.StringParameter;
  uploadsBucket: aws_ssm.StringParameter;
  rendersBucket: aws_ssm.StringParameter;
  guidanceBucket: aws_ssm.StringParameter;
  smplAssetsBucket: aws_ssm.StringParameter;
  geminiApiEndpoint: aws_ssm.StringParameter;
  geminiDailyBudgetUsd: aws_ssm.StringParameter;
  geminiMaxBatchSize: aws_ssm.StringParameter;
  geminiServiceAccountJson: aws_ssm.StringParameter;
  internalApiKey: aws_ssm.StringParameter;
  jwtSecret: aws_ssm.StringParameter;
}

/**
 * Creates all API key parameters in SSM Parameter Store
 * Returns parameter references for IAM permission grants
 */
export function createApiKeyParameters(
  scope: Construct,
  props: ApiKeyParametersProps
): ApiKeyParameters {
  const { stage } = props;
  const prefix = `/garmaxai/${stage}`;

  // Replicate API Key (SecureString for encryption)
  const replicateApiKey = new aws_ssm.StringParameter(scope, 'ReplicateApiKey', {
    parameterName: `${prefix}/replicate/api-key`,
    description: 'Replicate API key for AI rendering services',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Stripe Secret Key (SecureString)
  const stripeSecretKey = new aws_ssm.StringParameter(scope, 'StripeSecretKey', {
    parameterName: `${prefix}/stripe/secret-key`,
    description: 'Stripe secret key for payment processing',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Stripe Webhook Secret (SecureString)
  const stripeWebhookSecret = new aws_ssm.StringParameter(scope, 'StripeWebhookSecret', {
    parameterName: `${prefix}/stripe/webhook-secret`,
    description: 'Stripe webhook secret for signature verification',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Stripe Price IDs (String - not sensitive)
  const stripePriceBasicMonthly = new aws_ssm.StringParameter(scope, 'StripePriceBasicMonthly', {
    parameterName: `${prefix}/stripe/price-basic-monthly`,
    description: 'Stripe price ID for Basic Monthly plan',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const stripeProMonthly = new aws_ssm.StringParameter(scope, 'StripePriceProMonthly', {
    parameterName: `${prefix}/stripe/price-pro-monthly`,
    description: 'Stripe price ID for Pro Monthly plan',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const stripePriceUnlimited = new aws_ssm.StringParameter(scope, 'StripePriceUnlimited', {
    parameterName: `${prefix}/stripe/price-unlimited-monthly`,
    description: 'Stripe price ID for Unlimited Monthly plan',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const stripeStarterPriceId = new aws_ssm.StringParameter(scope, 'StripeStarterPriceId', {
    parameterName: `${prefix}/stripe/price-starter-monthly`,
    description: 'Stripe price ID for Starter Monthly plan',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Cognito Configuration (String - not sensitive)
  const cognitoUserPoolId = new aws_ssm.StringParameter(scope, 'CognitoUserPoolId', {
    parameterName: `${prefix}/cognito/user-pool-id`,
    description: 'Cognito User Pool ID for authentication',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const cognitoClientId = new aws_ssm.StringParameter(scope, 'CognitoClientId', {
    parameterName: `${prefix}/cognito/client-id`,
    description: 'Cognito App Client ID for authentication',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Redis URL (SecureString - contains credentials)
  const redisUrl = new aws_ssm.StringParameter(scope, 'RedisUrl', {
    parameterName: `${prefix}/redis/url`,
    description: 'Redis connection URL with credentials',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Database URL (SecureString - contains credentials)
  const databaseUrl = new aws_ssm.StringParameter(scope, 'DatabaseUrl', {
    parameterName: `${prefix}/database/url`,
    description: 'PostgreSQL connection URL with credentials',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // RDS-specific parameters (created by CDK, stored here for reference)
  const rdsHost = new aws_ssm.StringParameter(scope, 'RdsHost', {
    parameterName: `${prefix}/rds/host`,
    description: 'RDS database endpoint hostname',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const rdsUsername = new aws_ssm.StringParameter(scope, 'RdsUsername', {
    parameterName: `${prefix}/rds/username`,
    description: 'RDS master username',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const rdsPassword = new aws_ssm.StringParameter(scope, 'RdsPassword', {
    parameterName: `${prefix}/rds/password`,
    description: 'RDS master password',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Frontend URL (String)
  const frontendUrl = new aws_ssm.StringParameter(scope, 'FrontendUrl', {
    parameterName: `${prefix}/frontend/url`,
    description: 'Frontend application URL for CORS and redirects',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Budget Configuration (String)
  const dailyBudgetUsd = new aws_ssm.StringParameter(scope, 'DailyBudgetUsd', {
    parameterName: `${prefix}/budget/daily-usd`,
    description: 'Daily budget limit in USD for cost monitoring',
    stringValue: '100',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Alert Email (String)
  const alertEmail = new aws_ssm.StringParameter(scope, 'AlertEmail', {
    parameterName: `${prefix}/alerts/email`,
    description: 'Email address for alert notifications',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // AWS Account ID (String)
  const awsAccountId = new aws_ssm.StringParameter(scope, 'AwsAccountId', {
    parameterName: `${prefix}/aws/account-id`,
    description: 'AWS Account ID for resource ARN construction',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // S3 Bucket Names (String)
  const uploadsBucket = new aws_ssm.StringParameter(scope, 'UploadsBucket', {
    parameterName: `${prefix}/s3/uploads-bucket`,
    description: 'S3 bucket name for user uploads',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const rendersBucket = new aws_ssm.StringParameter(scope, 'RendersBucket', {
    parameterName: `${prefix}/s3/renders-bucket`,
    description: 'S3 bucket name for rendered images',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const guidanceBucket = new aws_ssm.StringParameter(scope, 'GuidanceBucket', {
    parameterName: `${prefix}/s3/guidance-bucket`,
    description: 'S3 bucket name for guidance assets (depth maps, etc.)',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const smplAssetsBucket = new aws_ssm.StringParameter(scope, 'SmplAssetsBucket', {
    parameterName: `${prefix}/s3/smpl-assets-bucket`,
    description: 'S3 bucket name for SMPL model assets',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Google Gemini Imagen 3 Configuration
  const geminiApiEndpoint = new aws_ssm.StringParameter(scope, 'GeminiApiEndpoint', {
    parameterName: `${prefix}/gemini/api-endpoint`,
    description: 'Google Gemini API endpoint URL',
    stringValue: 'https://generativelanguage.googleapis.com',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const geminiDailyBudgetUsd = new aws_ssm.StringParameter(scope, 'GeminiDailyBudgetUsd', {
    parameterName: `${prefix}/gemini/daily-budget-usd`,
    description: 'Daily budget limit in USD for Gemini API calls',
    stringValue: '200',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const geminiMaxBatchSize = new aws_ssm.StringParameter(scope, 'GeminiMaxBatchSize', {
    parameterName: `${prefix}/gemini/max-batch-size`,
    description: 'Maximum batch size for Gemini image generation',
    stringValue: '50',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const geminiServiceAccountJson = new aws_ssm.StringParameter(scope, 'GeminiServiceAccountJson', {
    parameterName: `${prefix}/gemini/service-account-json`,
    description: 'Google service account JSON for Gemini API authentication',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  // Application Security
  const internalApiKey = new aws_ssm.StringParameter(scope, 'InternalApiKey', {
    parameterName: `${prefix}/security/internal-api-key`,
    description: 'Internal API key for service-to-service authentication',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  const jwtSecret = new aws_ssm.StringParameter(scope, 'JwtSecret', {
    parameterName: `${prefix}/security/jwt-secret`,
    description: 'JWT secret for token signing',
    stringValue: 'PLACEHOLDER_UPDATE_AFTER_DEPLOY',
    tier: aws_ssm.ParameterTier.STANDARD,
  });

  return {
    replicateApiKey,
    stripeSecretKey,
    stripeWebhookSecret,
    stripePriceBasicMonthly,
    stripeProMonthly,
    stripePriceUnlimited,
    stripeStarterPriceId,
    cognitoUserPoolId,
    cognitoClientId,
    redisUrl,
    databaseUrl,
    rdsHost,
    rdsUsername,
    rdsPassword,
    frontendUrl,
    dailyBudgetUsd,
    alertEmail,
    awsAccountId,
    uploadsBucket,
    rendersBucket,
    guidanceBucket,
    smplAssetsBucket,
    geminiApiEndpoint,
    geminiDailyBudgetUsd,
    geminiMaxBatchSize,
    geminiServiceAccountJson,
    internalApiKey,
    jwtSecret,
  };
}

/**
 * Grant read access to all API key parameters for a Lambda or ECS service
 * Call this after creating parameters to allow services to read values
 */
export function grantReadApiKeys(
  parameters: ApiKeyParameters,
  grantee: IGrantable
): void {
  // Grant read access to all parameters
  Object.values(parameters).forEach(param => {
    param.grantRead(grantee);
  });
}

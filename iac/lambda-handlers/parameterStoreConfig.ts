/**
 * Parameter Store Configuration Loader
 * 
 * Utility functions for Lambda handlers to load API keys and configuration
 * from AWS Systems Manager Parameter Store instead of environment variables.
 * 
 * USAGE IN LAMBDA:
 * ===============
 * import { loadApiKeys } from './parameterStoreConfig';
 * 
 * const config = await loadApiKeys();
 * console.log(config.replicateApiKey);
 * 
 * CACHING:
 * =======
 * Parameters are cached in memory for the Lambda container lifetime.
 * Cold starts load fresh values, subsequent invocations reuse cache.
 */

import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({});
const STAGE = process.env.STAGE!;
const PREFIX = `/garmaxai/${STAGE}`;

// In-memory cache for parameter values (persists across warm starts)
let cachedConfig: ApiKeyConfig | null = null;

export interface ApiKeyConfig {
  replicateApiKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceBasicMonthly: string;
  stripePriceProMonthly: string;
  stripePriceUnlimited: string;
  stripeStarterPriceId: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  redisUrl: string;
  databaseUrl: string;
  rdsHost: string;
  rdsUsername: string;
  rdsPassword: string;
  frontendUrl: string;
  dailyBudgetUsd: string;
  alertEmail: string;
  awsAccountId: string;
  uploadsBucket: string;
  rendersBucket: string;
  guidanceBucket: string;
  smplAssetsBucket: string;
  geminiApiEndpoint: string;
  geminiDailyBudgetUsd: string;
  geminiMaxBatchSize: string;
  geminiServiceAccountJson: string;
  internalApiKey: string;
  jwtSecret: string;
}

/**
 * Load all API keys and configuration from Parameter Store
 * Results are cached in memory for subsequent invocations
 */
export async function loadApiKeys(): Promise<ApiKeyConfig> {
  // Return cached config if available (warm start)
  if (cachedConfig) {
    console.log('✅ Using cached Parameter Store configuration');
    return cachedConfig;
  }

  console.log('📥 Loading configuration from Parameter Store...');
  
  // Define all parameter names to fetch
  const parameterNames = [
    `${PREFIX}/replicate/api-key`,
    `${PREFIX}/stripe/secret-key`,
    `${PREFIX}/stripe/webhook-secret`,
    `${PREFIX}/stripe/price-basic-monthly`,
    `${PREFIX}/stripe/price-pro-monthly`,
    `${PREFIX}/stripe/price-unlimited-monthly`,
    `${PREFIX}/stripe/price-starter-monthly`,
    `${PREFIX}/cognito/user-pool-id`,
    `${PREFIX}/cognito/client-id`,
    `${PREFIX}/redis/url`,
    `${PREFIX}/database/url`,
    `${PREFIX}/rds/host`,
    `${PREFIX}/rds/username`,
    `${PREFIX}/rds/password`,
    `${PREFIX}/frontend/url`,
    `${PREFIX}/budget/daily-usd`,
    `${PREFIX}/alerts/email`,
    `${PREFIX}/aws/account-id`,
    `${PREFIX}/s3/uploads-bucket`,
    `${PREFIX}/s3/renders-bucket`,
    `${PREFIX}/s3/guidance-bucket`,
    `${PREFIX}/s3/smpl-assets-bucket`,
    `${PREFIX}/gemini/api-endpoint`,
    `${PREFIX}/gemini/daily-budget-usd`,
    `${PREFIX}/gemini/max-batch-size`,
    `${PREFIX}/gemini/service-account-json`,
    `${PREFIX}/security/internal-api-key`,
    `${PREFIX}/security/jwt-secret`,
  ];

  try {
    // Fetch all parameters in a single API call (more efficient)
    const response = await ssmClient.send(
      new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: true, // Decrypt SecureString parameters
      })
    );

    if (!response.Parameters || response.Parameters.length === 0) {
      throw new Error('No parameters returned from Parameter Store');
    }

    // Build config object from returned parameters
    const paramMap = new Map(
      response.Parameters.map(p => [p.Name!, p.Value!])
    );

    cachedConfig = {
      replicateApiKey: paramMap.get(`${PREFIX}/replicate/api-key`) || '',
      stripeSecretKey: paramMap.get(`${PREFIX}/stripe/secret-key`) || '',
      stripeWebhookSecret: paramMap.get(`${PREFIX}/stripe/webhook-secret`) || '',
      stripePriceBasicMonthly: paramMap.get(`${PREFIX}/stripe/price-basic-monthly`) || '',
      stripePriceProMonthly: paramMap.get(`${PREFIX}/stripe/price-pro-monthly`) || '',
      stripePriceUnlimited: paramMap.get(`${PREFIX}/stripe/price-unlimited-monthly`) || '',
      stripeStarterPriceId: paramMap.get(`${PREFIX}/stripe/price-starter-monthly`) || '',
      cognitoUserPoolId: paramMap.get(`${PREFIX}/cognito/user-pool-id`) || '',
      cognitoClientId: paramMap.get(`${PREFIX}/cognito/client-id`) || '',
      redisUrl: paramMap.get(`${PREFIX}/redis/url`) || '',
      databaseUrl: paramMap.get(`${PREFIX}/database/url`) || '',
      rdsHost: paramMap.get(`${PREFIX}/rds/host`) || '',
      rdsUsername: paramMap.get(`${PREFIX}/rds/username`) || '',
      rdsPassword: paramMap.get(`${PREFIX}/rds/password`) || '',
      frontendUrl: paramMap.get(`${PREFIX}/frontend/url`) || '',
      dailyBudgetUsd: paramMap.get(`${PREFIX}/budget/daily-usd`) || '100',
      alertEmail: paramMap.get(`${PREFIX}/alerts/email`) || '',
      awsAccountId: paramMap.get(`${PREFIX}/aws/account-id`) || '',
      uploadsBucket: paramMap.get(`${PREFIX}/s3/uploads-bucket`) || '',
      rendersBucket: paramMap.get(`${PREFIX}/s3/renders-bucket`) || '',
      guidanceBucket: paramMap.get(`${PREFIX}/s3/guidance-bucket`) || '',
      smplAssetsBucket: paramMap.get(`${PREFIX}/s3/smpl-assets-bucket`) || '',
      geminiApiEndpoint: paramMap.get(`${PREFIX}/gemini/api-endpoint`) || 'https://generativelanguage.googleapis.com',
      geminiDailyBudgetUsd: paramMap.get(`${PREFIX}/gemini/daily-budget-usd`) || '200',
      geminiMaxBatchSize: paramMap.get(`${PREFIX}/gemini/max-batch-size`) || '50',
      geminiServiceAccountJson: paramMap.get(`${PREFIX}/gemini/service-account-json`) || '',
      internalApiKey: paramMap.get(`${PREFIX}/security/internal-api-key`) || '',
      jwtSecret: paramMap.get(`${PREFIX}/security/jwt-secret`) || '',
    };

    // Check for any invalid parameters
    if (response.InvalidParameters && response.InvalidParameters.length > 0) {
      console.warn('⚠️  Invalid parameters:', response.InvalidParameters);
    }

    console.log('✅ Parameter Store configuration loaded successfully');
    return cachedConfig;

  } catch (error) {
    console.error('❌ Failed to load Parameter Store configuration:', error);
    throw new Error(`Parameter Store configuration failed: ${error.message}`);
  }
}

/**
 * Load a single parameter by name
 * Useful for loading optional or rarely-used parameters
 */
export async function loadParameter(name: string): Promise<string> {
  const fullName = name.startsWith('/') ? name : `${PREFIX}/${name}`;
  
  try {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: fullName,
        WithDecryption: true,
      })
    );

    return response.Parameter?.Value || '';
  } catch (error) {
    console.error(`❌ Failed to load parameter ${fullName}:`, error);
    throw error;
  }
}

/**
 * Clear cached configuration (useful for testing or forced reload)
 */
export function clearCache(): void {
  cachedConfig = null;
  console.log('🗑️  Parameter Store cache cleared');
}

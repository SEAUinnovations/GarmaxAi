export const env: {
  hostedZoneName: string;
  hostedZoneId: string;
  frontendDomainName?: string;
  backendDomainName?: string;
  backendHostedZoneName?: string;
  backendHostedZoneId?: string;
  AcmCert: { [region: string]: { id: string } };
  BackendAcmCert?: { [region: string]: { id: string } };
  certificateid: { [region: string]: { id: string } };
  vpc: { [region: string]: { id: string } };
  STAGE: string;
  DAILY_BUDGET_USD?: number;
  ALERT_EMAIL?: string;
  environmentVariables_1: { secrets_1: { snapshotARN: string; generatePassword: boolean; [k: string]: any } };
  [k: string]: any;
} = {
  // Placeholders — replace with your environment values
  hostedZoneName: 'PLACEHOLDER_HOSTED_ZONE',
  hostedZoneId: 'PLACEHOLDER_HOSTED_ZONE_ID',
  frontendDomainName: 'PLACEHOLDER_HOSTED_ZONE',
  backendDomainName: 'backend.PLACEHOLDER_HOSTED_ZONE',
  backendHostedZoneName: 'PLACEHOLDER_HOSTED_ZONE',
  backendHostedZoneId: 'PLACEHOLDER_HOSTED_ZONE_ID',
  AcmCert: {
    'us-east-1': { id: 'PLACEHOLDER_ACM_ARN' },
    'us-west-2': { id: 'PLACEHOLDER_ACM_ARN' },
  },
  BackendAcmCert: {
    'us-east-1': { id: 'PLACEHOLDER_BACKEND_ACM_ARN' },
    'us-west-2': { id: 'PLACEHOLDER_BACKEND_ACM_ARN' },
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
  
  // AI Rendering Provider Configuration
  RENDER_PROVIDER: 'replicate', // 'replicate' | 'bedrock' | 'ecs'
  ALLOW_BEDROCK_FAILOVER: false, // Feature gate - OFF by default
  BEDROCK_MAX_FAILOVER_PER_MIN: '3', // Circuit breaker limit
  BEDROCK_DAILY_BUDGET_USD: '50', // Daily spend cap for failover
  
  // Gemini Imagen 3 Integration Configuration
  // These settings control the gradual rollout from Replicate Nano Banana Pro to Google Gemini Imagen 3
  ENABLE_GEMINI_BATCH: false, // Master feature flag for Gemini batch processing
  GEMINI_TRAFFIC_PERCENT: '0', // Percentage of traffic routed to Gemini (0-100). Rollout: 10 -> 50 -> 100
  GEMINI_DAILY_BUDGET_USD: '200', // Daily spend cap for Gemini API (~4,000-8,000 images at $0.025-$0.05 per image)
  GEMINI_MAX_BATCH_SIZE: '50', // Maximum images per batch submission (fixed for initial 2-week rollout)
  GEMINI_BATCH_TIMEOUT_MS: '45000', // Batch submission timeout in milliseconds (45 seconds)
  GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com', // Google Generative Language API base URL
  
  // User Quotas and Limits
  MAX_RENDERS_PER_USER_DAILY: '25', // Per-user daily render limit
  MAX_TRYONS_PER_USER_DAILY: '100', // Per-user daily try-on limit
  
  // Feature Flags for Optional Components
  ENABLE_TRYON_PIPELINE: true, // Core try-on functionality
  ENABLE_RENDER_PROCESSOR: true, // AI rendering pipeline
  ENABLE_ECS_HEAVY_JOBS: false, // ECS for compute-intensive SMPL processing
  
  // SMPL Processing Configuration
  SMPL_PROCESSING_MODE: 'LAMBDA', // 'LAMBDA' | 'ECS' - Processing mode
  ECS_CLUSTER_NAME: '', // Will be set to cluster name when ECS is enabled
  ECS_TASK_DEFINITION: '', // Will be set to task definition ARN
  ECS_SUBNETS: [], // Private subnet IDs for ECS tasks
  
  // ECS Cost Optimization
  ECS_ENABLE_SPOT_INSTANCES: true, // Use Spot instances for 70% cost savings
  ECS_MAX_CONCURRENT_TASKS: 5, // Maximum concurrent SMPL processing tasks
  ECS_TASK_TIMEOUT_MINUTES: 10, // Maximum processing time per task
  
  // Event Bus Configuration
  EVENT_BUS_NAME: undefined, // Will be set to `GarmaxAi-Tryon-${STAGE}`
  environmentVariables_1: {
    secrets_1: {
      snapshotARN: 'PLACEHOLDER_SNAPSHOT_ARN',
      generatePassword: false,
    },
  },
};

/**
 * Get environment configuration based on STAGE
 * @param stage - The deployment stage (dev, qa, prod)
 * @returns Environment configuration object
 */
export function getEnvironmentConfig(stage: string) {
  const normalizedStage = stage.toLowerCase();
  
  switch (normalizedStage) {
    case 'dev':
    case 'development':
      return require('./DEV').default;
    case 'qa':
    case 'staging':
      return require('./QA').default;
    case 'prod':
    case 'production':
      return require('./PROD').default;
    default:
      throw new Error(`Unknown stage: ${stage}. Must be one of: dev, qa, prod`);
  }
}

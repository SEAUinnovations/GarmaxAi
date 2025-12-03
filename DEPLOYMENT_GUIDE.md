  ____    _    ____  __  __ _____  __  __
 / ___|  / \  |  _ \|  \/  | ____| \ \/ /
| |  _  / _ \ | |_) | |\/| |  _|    \  / 
| |_| |/ ___ \|  _ <| |  | | |___   /  \ 
 \____/_/   \_\_| \_\_|  |_|_____| /_/\_\

# GARMAX AI - Deployment Guide

**Complete production deployment and operations guide for GARMAX AI.** This guide covers infrastructure deployment, environment configuration, cost optimization, monitoring, and troubleshooting for production environments.

## 🔍 Key Files Quick Reference

### 🏗️ Infrastructure & Deployment
- **[`iac/lib/garmaxAiStack.ts`](iac/lib/garmaxAiStack.ts)** - Main CDK stack definition
- **[`iac/bin/iac.ts`](iac/bin/iac.ts)** - CDK app entry point
- **[`parameters/config.ts`](parameters/config.ts)** - Environment configuration
- **[`parameters/DEV.ts`](parameters/DEV.ts)** / **[`QA.ts`](parameters/QA.ts)** / **[`PROD.ts`](parameters/PROD.ts)** - Stage-specific configs
- **[`scripts/update-parameters.sh`](scripts/update-parameters.sh)** - Parameter Store deployment script

### 💰 Cost Optimization & Operations
- **[`scripts/ops/idle-teardown.sh`](scripts/ops/idle-teardown.sh)** - Scale down infrastructure for cost savings
- **[`scripts/ops/idle-restore.sh`](scripts/ops/idle-restore.sh)** - Restore services after idle period
- **[`iac/lib/Monitoring/createBudgetAlarms.ts`](iac/lib/Monitoring/createBudgetAlarms.ts)** - Budget monitoring configuration

### 🔐 Security & Configuration
- **[`iac/lib/ParameterStore/createParameterStore.ts`](iac/lib/ParameterStore/createParameterStore.ts)** - Centralized configuration management
- **[`iac/lib/IAM/`](iac/lib/IAM/)** - IAM roles and policies
- **[`iac/lib/Storage/`](iac/lib/Storage/)** - S3 bucket configurations with security
- **[`.env.example`](.env.example)** - Environment variables template

### 📊 Monitoring & Logging
- **[`iac/lib/Monitoring/createCloudWatchAlarms.ts`](iac/lib/Monitoring/createCloudWatchAlarms.ts)** - System health monitoring
- **[`healthcheck.py`](healthcheck.py)** - Health check scripts
- **[`iac/lib/Storage/createLogsBucket.ts`](iac/lib/Storage/createLogsBucket.ts)** - Centralized logging configuration

### ⚡ Processing & Lambda Functions
- **[`iac/lib/Lambda/`](iac/lib/Lambda/)** - Lambda function definitions
- **[`iac/lib/ECS/`](iac/lib/ECS/)** - ECS cluster for SMPL processing
- **[`iac/lib/EventBridge/`](iac/lib/EventBridge/)** - Event-driven architecture
- **[`iac/lib/SQS/`](iac/lib/SQS/)** - Queue configurations

## ☑️ Pre-Deployment Checklist

### 1. Prerequisites Verification
```bash
# Verify required tools
node --version    # v20.x required
npm --version     # v10.x required
aws --version     # v2.x required
docker --version  # Latest version

# AWS CLI configuration
aws configure list
aws sts get-caller-identity

# CDK installation
npm install -g aws-cdk@latest
cdk --version
```

### 2. Environment Configuration

**Copy and configure environment template:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required API Keys:**
```bash
# AI Rendering
REPLICATE_API_KEY=r8_xxxxxxxxxxxxx          # Get from: https://replicate.com/account
GEMINI_API_KEY=xxxxxxxxxxxxx               # Get from: Google Cloud Console

# Payments
STRIPE_SECRET_KEY=sk_xxxxxxxxxxxxx         # Stripe Dashboard > API Keys
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Stripe Webhooks

# AWS Services
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Budget Controls
DAILY_BUDGET_USD=200
ALERT_EMAIL=ops@your-company.com
```

### 3. Domain Configuration (Optional)

**For custom domains:**
```bash
# Domain settings in parameters/{STAGE}.ts
HOSTED_ZONE_NAME=your-domain.com
FRONTEND_DOMAIN_NAME=app.your-domain.com
BACKEND_DOMAIN_NAME=api.your-domain.com

# SSL Certificate ARN (must be in us-east-1 for CloudFront)
CERTIFICATE_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/xxxxx
```

### 4. Local Testing
```bash
# Start local infrastructure
docker-compose up -d

# Verify services
docker-compose ps
# Expected: mysql (healthy), redis (healthy), localstack (healthy)

# Run development server
npm run dev

# Test API health
curl http://localhost:3001/api/health
```

## 🚀 Deployment Process

### Development Environment (DEV)

**1. Bootstrap CDK (First Time Only)**
```bash
cd iac
npm install
cdk bootstrap --context stage=DEV
```

**2. Deploy Infrastructure**
```bash
# Deploy full stack
npm run cdk:deploy:dev

# Or deploy specific components
cdk deploy GarmaxAiStack-DEV --context stage=DEV
```

**3. Configure Parameters**
```bash
# Deploy parameters from .env
../scripts/update-parameters.sh DEV

# Verify parameters
aws ssm get-parameters-by-path \
  --path "/garmaxai/DEV" \
  --recursive \
  --query 'Parameters[].{Name:Name,Value:Value}'
```

**4. Verify Deployment**
```bash
# Check Lambda functions
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `GarmaxAi-DEV`)].{Name:FunctionName,Runtime:Runtime}'

# Check API Gateway
aws apigateway get-rest-apis \
  --query 'items[?contains(name, `GarmaxAi-DEV`)].{Name:name,Id:id}'

# Test health endpoint
curl https://YOUR_API_GATEWAY_URL/api/health
```

### Staging Environment (QA)

**1. Update Configuration**
```bash
# Edit staging configuration
vim parameters/QA.ts

# Key differences from DEV:
# - Production-like resource sizing
# - SSL certificates for custom domains
# - Enhanced monitoring and alerting
# - Limited AI rendering budgets for testing
```

**2. Deploy to Staging**
```bash
cd iac
npm run cdk:deploy:qa

# Or manual deployment with approval
cdk deploy GarmaxAiStack-QA --context stage=QA --require-approval broadening
```

**3. Run Deployment Tests**
```bash
# Test try-on workflow
curl -X POST https://qa-api.your-domain.com/api/tryon/sessions \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl":"test-avatar.jpg","garmentUrl":"test-garment.jpg"}'

# Test AI rendering (limited quota)
curl -X POST https://qa-api.your-domain.com/api/render \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session-123","quality":"sd"}'
```

### Production Environment (PROD)

**1. Final Configuration Review**
```bash
# Review production configuration
vim parameters/PROD.ts

# Production-specific settings:
# - Full resource allocation
# - Multi-AZ RDS deployment
# - Enhanced monitoring and backup
# - Full AI rendering budgets
# - Security hardening enabled
```

**2. Pre-Production Validation**
```bash
# Review deployment changes
cd iac
cdk diff GarmaxAiStack-PROD --context stage=PROD

# Validate CloudFormation template
cdk synth GarmaxAiStack-PROD --context stage=PROD > /tmp/prod-template.json
aws cloudformation validate-template --template-body file:///tmp/prod-template.json
```

**3. Production Deployment**
```bash
# Deploy with safety checks
cdk deploy GarmaxAiStack-PROD \
  --context stage=PROD \
  --require-approval broadening \
  --rollback

# Update production parameters
../scripts/update-parameters.sh PROD
```

**4. Post-Deployment Validation**
```bash
# Health checks
curl https://api.your-domain.com/api/health
curl https://api.your-domain.com/api/health/storage

# Monitor CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names "GarmaxAI-BudgetMonitor-PROD" "GarmaxAI-ErrorRate-PROD"

# Verify SSL certificates
openssl s_client -connect api.your-domain.com:443 -servername api.your-domain.com
```

## 🏗️ Infrastructure Components

### Core AWS Services

**Compute:**
- **Lambda Functions**: Serverless processing (Try-on, AI Rendering, Billing)
- **ECS Fargate**: SMPL processor with auto-scaling
- **API Gateway**: RESTful API with rate limiting

**Storage:**
- **S3 Buckets**: 5 separate buckets with lifecycle policies
- **RDS Aurora**: MySQL with automated backups
- **ElastiCache**: Redis for session management

**Security:**
- **IAM Roles**: Principle of least privilege
- **Parameter Store**: Encrypted configuration management
- **VPC**: Private subnets with NAT Gateway

**Monitoring:**
- **CloudWatch**: Metrics, alarms, and log aggregation
- **X-Ray**: Distributed tracing
- **Budget Alarms**: Cost control and alerting

### Resource Sizing by Environment

| Resource | DEV | QA | PROD |
|----------|-----|----|----|
| **Lambda Memory** | 512MB | 1024MB | 2048MB |
| **RDS Instance** | db.t3.micro | db.t3.small | db.r5.large |
| **ECS CPU/Memory** | 0.25/512 | 0.5/1024 | 1.0/2048 |
| **ElastiCache** | cache.t3.micro | cache.t3.small | cache.r5.large |
| **NAT Gateway** | 1 AZ | 2 AZ | 3 AZ |

## 💰 Cost Optimization

### Idle Management System

The idle management system can reduce costs by ~$78/month during inactive periods by scaling down non-essential services.

**Scale Down (Idle Teardown)**
```bash
# Scale down for cost savings
./scripts/ops/idle-teardown.sh PROD

# What it does:
# - Sets Lambda reserved concurrency to 0
# - Disables EventBridge rules
# - Creates monitoring for activity detection
# - Backs up configuration to Parameter Store
```

**Scale Up (Restore Services)**
```bash
# Restore full functionality
./scripts/ops/idle-restore.sh PROD

# What it does:
# - Removes Lambda concurrency limits
# - Re-enables EventBridge rules
# - Warms up functions
# - Tests connectivity
```

### Budget Controls

**Daily Budget Limits**
```bash
# Set in environment configuration
DAILY_BUDGET_USD=200
BEDROCK_DAILY_BUDGET_USD=50
REPLICATE_DAILY_BUDGET_USD=150

# Circuit breakers halt processing at thresholds:
# - 80%: Warning alerts
# - 90%: Disable Bedrock (fallback to Replicate)
# - 100%: Disable all AI rendering
```

**Per-User Quotas**
```bash
# Rate limiting configuration
MAX_TRYONS_PER_USER_DAILY=50
MAX_RENDERS_PER_USER_DAILY=20
MAX_CONCURRENT_RENDERS_PER_USER=3

# Prevents individual users from excessive consumption
```

### Resource Optimization

**S3 Lifecycle Policies**
```typescript
// Automatic cost optimization
const lifecycleRules = [
  {
    status: 'Enabled',
    transitions: [
      { days: 30, storageClass: 'STANDARD_IA' },
      { days: 90, storageClass: 'GLACIER' },
      { days: 365, storageClass: 'DEEP_ARCHIVE' }
    ],
    expiration: { days: 2555 } // 7 years
  }
];
```

**Lambda Optimization**
```typescript
// Cost-efficient Lambda configuration
const lambdaConfig = {
  runtime: Runtime.NODEJS_20_X,
  memorySize: stage === 'PROD' ? 2048 : 512,
  timeout: Duration.minutes(5),
  reservedConcurrentExecutions: stage === 'PROD' ? 10 : 2,
  deadLetterQueue: { maxReceiveCount: 3 }
};
```

## 📊 Monitoring & Alerting

### CloudWatch Alarms

**Critical System Alerts**
```bash
# Error rate monitoring
aws cloudwatch put-metric-alarm \
  --alarm-name "GarmaxAI-ErrorRate-PROD" \
  --alarm-description "High error rate detected" \
  --metric-name ErrorCount \
  --namespace "AWS/ApiGateway" \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# Budget monitoring
aws cloudwatch put-metric-alarm \
  --alarm-name "GarmaxAI-BudgetMonitor-PROD" \
  --alarm-description "Daily budget threshold exceeded" \
  --metric-name EstimatedCharges \
  --namespace "AWS/Billing" \
  --statistic Maximum \
  --period 86400 \
  --threshold 200 \
  --comparison-operator GreaterThanThreshold
```

**Performance Monitoring**
```bash
# Lambda duration alerts
aws cloudwatch put-metric-alarm \
  --alarm-name "GarmaxAI-LambdaDuration-PROD" \
  --alarm-description "Lambda execution time too high" \
  --metric-name Duration \
  --namespace "AWS/Lambda" \
  --statistic Average \
  --period 300 \
  --threshold 30000 \
  --comparison-operator GreaterThanThreshold

# Queue depth monitoring
aws cloudwatch put-metric-alarm \
  --alarm-name "GarmaxAI-QueueDepth-PROD" \
  --alarm-description "SQS queue backing up" \
  --metric-name ApproximateNumberOfMessages \
  --namespace "AWS/SQS" \
  --statistic Average \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

### Log Management

**Centralized Logging**
```bash
# Lambda function logs
aws logs create-log-group --log-group-name "/aws/lambda/GarmaxAi-TryonProcessor-PROD"
aws logs create-log-group --log-group-name "/aws/lambda/GarmaxAi-AiRenderProcessor-PROD"
aws logs create-log-group --log-group-name "/aws/lambda/GarmaxAi-BillingProcessor-PROD"

# API Gateway logs
aws logs create-log-group --log-group-name "/aws/apigateway/GarmaxAi-PROD"

# Set retention policy (90 days for production)
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/GarmaxAi-TryonProcessor-PROD" \
  --retention-in-days 90
```

**Log Aggregation Queries**
```bash
# Find errors across all Lambda functions
aws logs start-query \
  --log-group-names "/aws/lambda/GarmaxAi-TryonProcessor-PROD" "/aws/lambda/GarmaxAi-AiRenderProcessor-PROD" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc'

# Monitor AI rendering performance
aws logs start-query \
  --log-group-names "/aws/lambda/GarmaxAi-AiRenderProcessor-PROD" \
  --start-time $(date -d '1 day ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /render complete/ | stats avg(@duration) by bin(5m)'
```

## 🔐 Security Configuration

### Parameter Store Management

**Secure Configuration Storage**
```bash
# Deploy parameters securely
./scripts/update-parameters.sh PROD

# Parameter hierarchy:
/garmaxai/PROD/
├── replicate/api-key          [SecureString, KMS encrypted]
├── stripe/secret-key          [SecureString, KMS encrypted]
├── database/url               [SecureString, KMS encrypted]
├── redis/url                  [SecureString, KMS encrypted]
└── frontend/url               [String, not sensitive]
```

**IAM Roles and Policies**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/garmaxai/PROD/*"
    }
  ]
}
```

### S3 Security

**Bucket Policies**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::garmaxai-uploads-prod/*",
        "arn:aws:s3:::garmaxai-uploads-prod"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

**Encryption Configuration**
```typescript
// S3 server-side encryption
const bucketEncryption = {
  algorithm: BucketEncryption.S3_MANAGED,
  bucketKeyEnabled: true
};

// RDS encryption
const rdsEncryption = {
  storageEncrypted: true,
  kmsKey: Key.fromLookup(scope, 'RdsKey', { aliasName: 'alias/aws/rds' })
};
```

## 🚨 Troubleshooting Guide

### Common Deployment Issues

**1. CDK Bootstrap Errors**
```bash
# Error: CDK toolkit version mismatch
Solution:
npm install -g aws-cdk@latest
cdk bootstrap --force

# Error: Insufficient permissions
Solution:
aws iam attach-user-policy \
  --user-name YOUR_USER \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**2. Parameter Store Access Errors**
```bash
# Error: Parameter not found
aws ssm get-parameter --name "/garmaxai/PROD/replicate/api-key" --with-decryption

# Fix: Ensure parameters are deployed
./scripts/update-parameters.sh PROD

# Error: Access denied
# Fix: Check IAM permissions for Lambda execution role
```

**3. Lambda Function Failures**
```bash
# Check function logs
aws logs tail /aws/lambda/GarmaxAi-TryonProcessor-PROD --follow

# Common issues:
# - Timeout: Increase function timeout in CDK configuration
# - Memory: Increase memory allocation
# - Permissions: Check IAM role policies
```

**4. API Gateway Issues**
```bash
# Test API directly
aws apigateway test-invoke-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method GET

# Check CloudWatch logs
aws logs tail /aws/apigateway/GarmaxAi-PROD --follow
```

### Performance Optimization

**1. Cold Start Mitigation**
```typescript
// Provision concurrency for critical functions
const provisioning = new ProvisionedConcurrencyConfig(scope, 'ProvisionedConfig', {
  function: lambdaFunction,
  provisionedConcurrentExecutions: 5
});
```

**2. Database Connection Pooling**
```typescript
// RDS Proxy for connection pooling
const rdsProxy = new DatabaseProxy(scope, 'RdsProxy', {
  proxyTarget: ProxyTarget.fromCluster(aurora),
  secrets: [databaseSecret],
  vpc: vpc
});
```

**3. Redis Optimization**
```bash
# Monitor Redis performance
aws elasticache describe-cache-clusters \
  --cache-cluster-id garmaxai-redis-prod \
  --show-cache-node-info

# Check memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=CacheClusterId,Value=garmaxai-redis-prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average
```

## 🔄 Maintenance Operations

### Regular Maintenance Tasks

**Weekly:**
```bash
# Check budget utilization
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Review CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# Check Lambda error rates
aws logs start-query \
  --log-group-names "/aws/lambda/GarmaxAi-TryonProcessor-PROD" \
  --start-time $(date -d '7 days ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp | filter @message like /ERROR/ | stats count() by bin(1d)'
```

**Monthly:**
```bash
# Update CDK dependencies
cd iac
npm update
npm audit fix

# Review and rotate API keys
# - Generate new Replicate API key
# - Update Parameter Store
# - Redeploy Lambda functions

# Database maintenance
aws rds describe-db-clusters \
  --db-cluster-identifier garmaxai-cluster-prod \
  --query 'DBClusters[0].{Status:Status,BackupRetention:BackupRetentionPeriod}'
```

### Disaster Recovery

**Backup Strategy:**
- **RDS**: Automated backups with 7-day retention
- **S3**: Cross-region replication for critical buckets
- **Parameter Store**: Export parameters to encrypted backup
- **Code**: Git repository with automated deployments

**Recovery Procedures:**
```bash
# Database point-in-time recovery
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier garmaxai-cluster-recovery \
  --source-db-cluster-identifier garmaxai-cluster-prod \
  --restore-to-time 2024-01-15T10:30:00.000Z

# Redeploy entire stack
cd iac
cdk deploy GarmaxAiStack-PROD --context stage=PROD
```

## ✅ Post-Deployment Checklist

### Functional Testing
- [ ] API health checks pass
- [ ] Try-on workflow completes end-to-end
- [ ] AI rendering generates images successfully
- [ ] WebSocket real-time updates work
- [ ] Payment processing (Stripe) functions
- [ ] User authentication works

### Performance Testing
- [ ] Load test API endpoints
- [ ] Verify Lambda cold start performance
- [ ] Check database connection pooling
- [ ] Test queue processing under load
- [ ] Validate auto-scaling behavior

### Security Validation
- [ ] SSL certificates valid and auto-renewing
- [ ] IAM roles follow least privilege
- [ ] S3 buckets have proper access controls
- [ ] Parameter Store encryption working
- [ ] VPC security groups configured correctly

### Monitoring Setup
- [ ] CloudWatch alarms configured and tested
- [ ] Budget alerts active
- [ ] Log aggregation working
- [ ] Performance metrics collecting
- [ ] Error tracking functional

## 🎯 Next Steps

After successful deployment:

1. **Monitor Initial Traffic**: Watch CloudWatch metrics for first 24-48 hours
2. **Gradual Rollout**: If using traffic routing, increase percentages slowly
3. **Performance Tuning**: Optimize based on real-world usage patterns
4. **Cost Review**: Analyze first month's costs and adjust budgets
5. **Security Audit**: Run automated security scans and penetration tests

**You're now ready for production! 🚀**

For ongoing operations, refer to the monitoring sections and set up automated alerts for proactive issue detection.
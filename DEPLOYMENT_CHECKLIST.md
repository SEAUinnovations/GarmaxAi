# 🚀 Deployment Checklist

Use this checklist to verify all steps before deploying to cloud.

---

## ☑️ Pre-Deployment Verification

### 1. Environment Setup
- [ ] Docker installed and running
- [ ] Node.js 18+ installed
- [ ] AWS CLI configured
- [ ] CDK installed globally (`npm i -g aws-cdk`)

### 2. Local Testing
```bash
# Start infrastructure
[ ] docker-compose up -d

# Verify all services healthy
[ ] docker-compose ps
# Expected: mysql (healthy), redis (healthy), localstack (healthy), adminer (healthy)

# Check logs for errors
[ ] docker-compose logs mysql | grep ERROR
[ ] docker-compose logs redis | grep ERROR
[ ] docker-compose logs localstack | grep ERROR

# No errors should be found
```

### 3. Database Setup
```bash
# Run migrations
[ ] npm run db:push

# Seed subscription plans
[ ] npm run db:seed:plans
# Expected output: "✅ Migration completed successfully!"

# Verify plans in database
[ ] docker-compose exec mysql mysql -u garmaxai -pgarmaxai_password -e "SELECT * FROM garmaxai.subscriptionPlans;"
# Expected: 4 rows (free, starter, pro, premium)
```

### 4. API Keys Configuration

**Required Keys (Copy to .env):**
```bash
# Replicate (AI Rendering)
[ ] REPLICATE_API_KEY=r8_xxxxxxxxxxxxx
# Get from: https://replicate.com/account/api-tokens

# Stripe (Payments)
[ ] STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
[ ] STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
# Get from: https://dashboard.stripe.com/apikeys

# Stripe Price IDs (after creating products)
[ ] STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxxxxx
[ ] STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxx
[ ] STRIPE_PREMIUM_PRICE_ID=price_xxxxxxxxxxxxx
# Create products: https://dashboard.stripe.com/products

# AWS Cognito
[ ] COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxxxxxx
[ ] COGNITO_CLIENT_ID=xxxxxxxxxxxxx
# Get from: AWS Console > Cognito > User Pools

# Redis (Production - ElastiCache or Upstash)
[ ] REDIS_URL=redis://xxxxxxxxxxxxx:6379
# For local: redis://localhost:6379

# Budget Monitoring
[ ] DAILY_BUDGET_USD=50
[ ] ALERT_EMAIL=your-email@example.com
```

### 5. Stripe Configuration

**Create Products in Stripe Dashboard:**
```bash
[ ] Navigate to https://dashboard.stripe.com/products
[ ] Click "Add product"

# Product 1: Starter
[ ] Name: "GarmaxAI Starter"
[ ] Pricing: $9.99 USD monthly recurring
[ ] Copy price ID to STRIPE_STARTER_PRICE_ID

# Product 2: Pro
[ ] Name: "GarmaxAI Pro"
[ ] Pricing: $29.99 USD monthly recurring
[ ] Copy price ID to STRIPE_PRO_PRICE_ID

# Product 3: Premium
[ ] Name: "GarmaxAI Premium"
[ ] Pricing: $99.99 USD monthly recurring
[ ] Copy price ID to STRIPE_PREMIUM_PRICE_ID

# Configure Webhook
[ ] Go to https://dashboard.stripe.com/webhooks
[ ] Add endpoint: https://your-api-domain.com/api/payments/webhook
[ ] Select events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
[ ] Copy webhook signing secret to STRIPE_WEBHOOK_SECRET
```

### 6. Test Fixtures
```bash
[ ] Create tests/fixtures/test-person.jpg
    # Full-body person photo, 1024x1024+, front-facing

[ ] Create tests/fixtures/test-person-2.jpg
    # Different person for cache testing

[ ] Create tests/fixtures/test-garment.jpg
    # Clothing item (shirt/hoodie), 512x512+

# Verify files exist
[ ] ls -lh tests/fixtures/*.jpg
```

### 7. Run Tests
```bash
# Backend tests
[ ] npm run test
# Expected: All tests passing

# Frontend tests
[ ] npm run test:frontend
# Expected: All tests passing

# E2E tests
[ ] npm run test:e2e
# Expected: All 3 suites passing (tryonFlow, paymentFlow, caching)

# Full test suite
[ ] npm run test:all
# Expected: No failures
```

---

## ☑️ Staging Deployment

### 1. CDK Configuration
```bash
[ ] cd iac

# Update parameters/QA.ts with your values
[ ] vim ../parameters/QA.ts
# Set: hostedZoneName, hostedZoneId, certificateid ARNs

# Install dependencies
[ ] npm install

# Bootstrap CDK (first time only)
[ ] npm run cdk bootstrap -- --context stage=qa

# Synthesize CloudFormation
[ ] npm run cdk synth -- --context stage=qa
# Expected: No errors, CloudFormation template generated
```

### 2. Deploy Infrastructure
```bash
# Deploy to staging
[ ] npm run cdk deploy -- --context stage=qa --require-approval never

# Expected output:
# - VPC created
# - S3 buckets created (uploads, renders, guidance, smpl-assets, logs)
# - RDS Aurora cluster created
# - ECS cluster created
# - Lambda functions deployed
# - EventBridge rules created
# - CloudWatch alarms created
# - Outputs displayed with ARNs and URLs

# Copy outputs to .env
[ ] Copy API Gateway URL
[ ] Copy CloudFront distribution URL
[ ] Copy RDS connection string
```

### 3. Verify Deployment
```bash
# Check Lambda functions
[ ] aws lambda list-functions --query 'Functions[?contains(FunctionName, `GarmaxAi`)]'

# Check CloudWatch alarms
[ ] aws cloudwatch describe-alarms --alarm-names "GarmaxAI-BudgetMonitor-qa"

# Check S3 buckets
[ ] aws s3 ls | grep garmaxai

# Test API health endpoint
[ ] curl https://your-api-url.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 4. Database Migration (Staging)
```bash
# Connect to RDS
[ ] Update DATABASE_URL in .env with RDS connection string

# Run migrations
[ ] npm run db:push

# Seed plans
[ ] npm run db:seed:plans

# Verify
[ ] npm run db:migrate:rds -- --verify
```

### 5. Monitor Budget
```bash
# Confirm SNS email subscription
[ ] Check email for "AWS Notification - Subscription Confirmation"
[ ] Click "Confirm subscription"

# View CloudWatch dashboard
[ ] aws cloudwatch get-dashboard --dashboard-name "GarmaxAI-Budget-qa"

# Set initial alarm (should be in OK state)
[ ] aws cloudwatch describe-alarms --alarm-names "GarmaxAI-EstimatedCharges-qa"
# Expected: "StateValue": "OK"
```

---

## ☑️ Production Deployment

### 1. Pre-Production Checks
```bash
# Verify staging working for 24+ hours
[ ] Check CloudWatch metrics for errors
[ ] Verify no budget alarms triggered
[ ] Test all user flows (signup, upload, try-on, payment)
[ ] Load test with realistic traffic

# Review costs
[ ] aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-02 --granularity DAILY --metrics BlendedCost
# Verify under budget
```

### 2. Production Deployment
```bash
[ ] cd iac

# Update parameters/PROD.ts
[ ] vim ../parameters/PROD.ts

# Deploy to production
[ ] npm run cdk deploy -- --context stage=prod --require-approval always
# Carefully review changeset before approving

# Enable deletion protection
[ ] aws rds modify-db-cluster --db-cluster-identifier garmaxai-prod --deletion-protection

# Enable backups
[ ] aws backup start-backup-job ...
```

### 3. Traffic Migration
```bash
# Update DNS
[ ] Update A record to point to CloudFront distribution

# Monitor traffic
[ ] Watch CloudWatch dashboard
[ ] Monitor error rates
[ ] Check WebSocket connections

# Gradual rollout (if using Route53 weighted routing)
[ ] 10% traffic for 1 hour
[ ] 50% traffic for 1 hour
[ ] 100% traffic
```

### 4. Post-Deployment Verification
```bash
# Test critical paths
[ ] User signup/login
[ ] Avatar creation
[ ] Garment upload
[ ] Try-on session
[ ] Payment flow
[ ] Webhook processing

# Monitor for 1 hour
[ ] CloudWatch alarms (none firing)
[ ] Error rates (<1%)
[ ] API latency (<500ms p99)
[ ] Database connections stable
[ ] Cost tracking under budget
```

---

## ☑️ Rollback Procedure

**If issues detected in production:**

```bash
# Option 1: Rollback DNS (fastest)
[ ] Revert DNS A record to previous API Gateway
[ ] Wait 60s for propagation
[ ] Verify old version serving traffic

# Option 2: Rollback CDK stack
[ ] cd iac
[ ] git log --oneline  # Find previous commit
[ ] git checkout <previous-commit>
[ ] npm run cdk deploy -- --context stage=prod
[ ] Confirm rollback in changeset

# Option 3: Emergency kill switch
[ ] Disable Lambda functions
[ ] aws lambda update-function-configuration --function-name ... --environment Variables={MAINTENANCE_MODE=true}

# Post-rollback
[ ] Investigate logs
[ ] Fix issue in staging
[ ] Re-test before re-deploying
```

---

## 📊 Success Criteria

**Deployment is successful when:**

- [ ] All health checks passing
- [ ] Error rate <1%
- [ ] API latency <500ms p99
- [ ] WebSocket connections stable
- [ ] Database queries <100ms p95
- [ ] No CloudWatch alarms firing
- [ ] Daily costs under $50
- [ ] All E2E tests passing in production
- [ ] Payment flow working (test with Stripe test cards)
- [ ] No JavaScript console errors on frontend

---

## 🆘 Troubleshooting

### Issue: Lambda Timeout
```bash
# Increase timeout
aws lambda update-function-configuration --function-name tryonProcessor-qa --timeout 300
```

### Issue: Database Connection Pool Exhausted
```bash
# Increase max connections
aws rds modify-db-cluster --db-cluster-identifier garmaxai-qa --max-connections 1000
```

### Issue: S3 Upload Fails (CORS)
```bash
# Update bucket CORS
aws s3api put-bucket-cors --bucket garmaxai-uploads-qa --cors-configuration file://cors.json
```

### Issue: Budget Alarm False Positive
```bash
# Check actual costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-02 --granularity DAILY --metrics BlendedCost

# Adjust threshold if needed
aws cloudwatch put-metric-alarm --alarm-name GarmaxAI-EstimatedCharges-qa --threshold 60
```

---

## 📞 Support Contacts

- **AWS Support:** Use AWS Console Support Center
- **Stripe Support:** https://support.stripe.com
- **Replicate Support:** support@replicate.com
- **Team Lead:** [Your contact info]

---

**Last Updated:** $(date)  
**Version:** 1.0  
**Status:** Ready for Deployment ✅

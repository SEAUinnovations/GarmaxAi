# Gemini Imagen 3 Gradual Rollout - Quick Reference

## Pre-Deployment Checklist

- [ ] Review all code changes in PR
- [ ] Run database migration locally
- [ ] Obtain Google service account JSON key
- [ ] Configure AWS Parameter Store paths
- [ ] Create DynamoDB budget tracking table
- [ ] Set up CloudWatch alarms
- [ ] Test fallback chains in staging
- [ ] Document rollback procedure

---

## Deployment Commands

### 1. Deploy Infrastructure
```bash
cd iac
npm install
npm run cdk synth
npm run cdk deploy --all
```

### 2. Run Database Migration
```bash
npm run migrate
```

### 3. Configure Parameter Store
```bash
# Store Google service account credentials (one-time setup)
aws ssm put-parameter \
  --name "/garmaxai/gemini/production/service-account-json" \
  --value file://google-service-account.json \
  --type SecureString \
  --region us-east-1

# Verify parameter
aws ssm get-parameter \
  --name "/garmaxai/gemini/production/service-account-json" \
  --with-decryption \
  --region us-east-1
```

### 4. Create DynamoDB Budget Table
```bash
aws dynamodb create-table \
  --table-name gemini_budget_tracking_production \
  --attribute-definitions AttributeName=date,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Verify table
aws dynamodb describe-table \
  --table-name gemini_budget_tracking_production \
  --region us-east-1
```

---

## Rollout Phases

### Phase 0: Verification (Default State)
**Environment Variables:**
- `ENABLE_GEMINI_BATCH=false`
- `GEMINI_TRAFFIC_PERCENT=0`

**Actions:**
- Deploy with flags OFF
- Verify infrastructure created
- Test API endpoints
- Validate monitoring dashboards

**Duration:** 1-2 days

---

### Phase 1: 10% Traffic
**When:** After successful Phase 0 verification

**Update Config:**
```typescript
// parameters/config.ts
ENABLE_GEMINI_BATCH: true,
GEMINI_TRAFFIC_PERCENT: '10',
```

**Deploy:**
```bash
npm run cdk deploy
```

**Monitor:**
```bash
# Check budget consumption
aws dynamodb get-item \
  --table-name gemini_budget_tracking_production \
  --key '{"date":{"S":"2025-12-01"}}' \
  --region us-east-1

# Check batch queue depth
aws sqs get-queue-attributes \
  --queue-url <GEMINI_BATCH_QUEUE_URL> \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1

# View logs
aws logs tail /aws/lambda/GarmaxAi-AiRenderProcessor-production \
  --follow \
  --region us-east-1
```

**Validation Criteria:**
- [ ] Cost per image < $0.05
- [ ] P95 latency < 60 seconds
- [ ] Batch failure rate < 5%
- [ ] Quality parity score > 0.9
- [ ] Processed ≥ 500 images
- [ ] Running for ≥ 3 days

**Duration:** 3 days minimum

---

### Phase 2: 50% Traffic
**When:** After Phase 1 validation passes

**Update Config:**
```typescript
GEMINI_TRAFFIC_PERCENT: '50',
```

**Deploy:**
```bash
npm run cdk deploy
```

**Validation Criteria:**
- [ ] Cost per image < $0.05 (sustained)
- [ ] P95 latency < 60 seconds (sustained)
- [ ] Batch failure rate < 5%
- [ ] No circuit breaker triggers
- [ ] Processed ≥ 2,000 images
- [ ] Running for ≥ 7 days

**Duration:** 7 days minimum

---

### Phase 3: 100% Traffic
**When:** After Phase 2 validation passes

**Update Config:**
```typescript
GEMINI_TRAFFIC_PERCENT: '100',
```

**Deploy:**
```bash
npm run cdk deploy
```

**Post-Rollout:**
- Monitor for 1 week
- Compare costs vs Replicate baseline
- Archive Nano Banana Pro code (don't delete yet)
- Update documentation

**Duration:** 1 week monitoring

---

## Monitoring Queries

### Check Daily Budget Consumption
```bash
# Today's spend
aws dynamodb get-item \
  --table-name gemini_budget_tracking_production \
  --key "{\"date\":{\"S\":\"$(date +%Y-%m-%d)\"}}" \
  --region us-east-1 \
  --query 'Item.consumed_usd.N' \
  --output text
```

### Check Batch Success Rate
```sql
-- Run in MySQL/RDS
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM gemini_batch_jobs), 2) as percentage
FROM gemini_batch_jobs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY status;
```

### Check Queue Depth
```bash
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name GarmaxAi-GeminiBatchProcessing-production.fifo --query 'QueueUrl' --output text) \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible \
  --region us-east-1
```

### View Recent Logs
```bash
# AI Render Processor logs
aws logs tail /aws/lambda/GarmaxAi-AiRenderProcessor-production \
  --follow \
  --filter-pattern "Gemini" \
  --region us-east-1
```

---

## Rollback Procedure

### Immediate Rollback (Emergency)
```bash
# Set traffic to 0%
aws ssm put-parameter \
  --name "/garmaxai/gemini/production/traffic-percent" \
  --value "0" \
  --type String \
  --overwrite \
  --region us-east-1

# Or disable feature flag
# Update config: ENABLE_GEMINI_BATCH: false
npm run cdk deploy
```

### Gradual Rollback
```bash
# Reduce to 50%
GEMINI_TRAFFIC_PERCENT='50'
npm run cdk deploy

# Wait 1 hour, monitor

# Reduce to 10%
GEMINI_TRAFFIC_PERCENT='10'
npm run cdk deploy

# Wait 1 hour, monitor

# Disable
GEMINI_TRAFFIC_PERCENT='0'
npm run cdk deploy
```

---

## Troubleshooting

### Issue: Circuit Breaker Triggered

**Symptom:**
```
ERROR: Gemini circuit breaker open: daily budget limit reached
```

**Diagnosis:**
```bash
# Check today's spend
aws dynamodb get-item \
  --table-name gemini_budget_tracking_production \
  --key "{\"date\":{\"S\":\"$(date +%Y-%m-%d)\"}}" \
  --region us-east-1
```

**Solution:**
1. Review unexpected usage spike
2. If justified, increase budget:
   ```typescript
   GEMINI_DAILY_BUDGET_USD: '300', // Increased from 200
   ```
3. Redeploy
4. Reset DynamoDB counter if needed:
   ```bash
   aws dynamodb delete-item \
     --table-name gemini_budget_tracking_production \
     --key "{\"date\":{\"S\":\"$(date +%Y-%m-%d)\"}}" \
     --region us-east-1
   ```

---

### Issue: Authentication Failed

**Symptom:**
```
ERROR: Gemini authentication failed: unable to load service account credentials
```

**Diagnosis:**
```bash
# Verify parameter exists
aws ssm get-parameter \
  --name "/garmaxai/gemini/production/service-account-json" \
  --with-decryption \
  --region us-east-1
```

**Solution:**
1. Re-upload service account JSON:
   ```bash
   aws ssm put-parameter \
     --name "/garmaxai/gemini/production/service-account-json" \
     --value file://google-service-account.json \
     --type SecureString \
     --overwrite \
     --region us-east-1
   ```
2. Verify JSON format is valid
3. Check IAM permissions for Lambda

---

### Issue: High Latency

**Symptom:**
Users waiting > 60 seconds for results

**Diagnosis:**
```bash
# Check batch sizes
# Run SQL query
SELECT 
  AVG(image_count) as avg_batch_size,
  AVG(TIMESTAMPDIFF(SECOND, submitted_at, completed_at)) as avg_time_seconds
FROM gemini_batch_jobs
WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

**Solution:**
1. Reduce batch timeout:
   ```typescript
   GEMINI_BATCH_TIMEOUT_MS: '30000', // Reduced from 45000
   ```
2. Or reduce batch size:
   ```typescript
   GEMINI_MAX_BATCH_SIZE: '30', // Reduced from 50
   ```
3. Redeploy

---

### Issue: Batch Failures

**Symptom:**
Many batches with status "failed"

**Diagnosis:**
```sql
SELECT 
  error_message,
  COUNT(*) as count
FROM gemini_batch_jobs
WHERE status = 'failed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY error_message;
```

**Solution:**
1. Review error messages
2. Check Gemini API status
3. Verify API quotas not exceeded
4. Test single image generation
5. If persistent, reduce traffic or rollback

---

## Metrics Dashboard

### Key Metrics to Monitor

| Metric | Target | Query |
|--------|--------|-------|
| Cost per Image | < $0.05 | DynamoDB `consumed_usd / request_count` |
| P95 Latency | < 60s | CloudWatch `Duration` P95 |
| Batch Success Rate | > 95% | SQL `completed / total` |
| Queue Depth | < 100 | SQS `ApproximateNumberOfMessages` |
| Circuit Breaker Triggers | 0 | CloudWatch Alarms |

---

## Contact & Escalation

**For Issues During Rollout:**
1. Check this runbook first
2. Review CloudWatch logs
3. Check #gemini-rollout Slack channel
4. Escalate to on-call engineer if:
   - Cost spike > 150% expected
   - Failure rate > 10%
   - Circuit breaker triggered unexpectedly
   - User-facing errors increasing

**Emergency Rollback Authority:**
Any engineer can execute immediate rollback (set traffic to 0%) without approval if:
- User-facing error rate > 5%
- Cost exceeding budget by > 50%
- Circuit breaker repeatedly triggering

---

## Post-Rollout Checklist

After reaching 100% traffic:

- [ ] Update architecture documentation
- [ ] Archive Replicate Nano Banana code
- [ ] Document lessons learned
- [ ] Optimize batch parameters based on metrics
- [ ] Plan dynamic batching implementation
- [ ] Schedule cost review meeting
- [ ] Update incident runbooks
- [ ] Train team on new system

---

## Quick Reference: Environment Variables

```typescript
// Default (Disabled)
ENABLE_GEMINI_BATCH: false
GEMINI_TRAFFIC_PERCENT: '0'

// Phase 1 (10%)
ENABLE_GEMINI_BATCH: true
GEMINI_TRAFFIC_PERCENT: '10'

// Phase 2 (50%)
GEMINI_TRAFFIC_PERCENT: '50'

// Phase 3 (100%)
GEMINI_TRAFFIC_PERCENT: '100'

// Budget & Batch Settings (Fixed)
GEMINI_DAILY_BUDGET_USD: '200'
GEMINI_MAX_BATCH_SIZE: '50'
GEMINI_BATCH_TIMEOUT_MS: '45000'
GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com'
```

---

## Success Criteria Summary

✅ **Phase 1 → Phase 2:**
- 3 days running
- 500+ images processed
- All metrics within targets

✅ **Phase 2 → Phase 3:**
- 7 days running
- 2,000+ images processed
- All metrics within targets

✅ **Complete Rollout:**
- 1 week at 100%
- Cost savings validated
- User satisfaction maintained

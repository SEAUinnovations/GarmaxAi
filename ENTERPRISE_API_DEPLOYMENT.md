# Enterprise API Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [x] All TypeScript compilation errors resolved
- [x] All enterprise API TODOs completed
- [x] Integration tests passing (40+ test cases)
- [x] No console.log statements in production code
- [x] Error handling implemented for all endpoints
- [x] Proper logging with winston-logger

### Security
- [x] API key hashing with bcrypt (10 rounds)
- [x] Webhook signature verification (HMAC-SHA256)
- [x] Rate limiting implemented (token bucket)
- [x] Scope validation on all protected endpoints
- [x] Input validation with proper error messages
- [x] SQL injection protection (parameterized queries)
- [x] XSS protection (proper escaping)

### Database
- [ ] Run migrations for new tables:
  - `organizations`
  - `api_keys`
  - `external_customers`
  - `cart_tryon_sessions`
  - `webhooks`
  - `api_usage_logs`
- [ ] Add indexes for performance:
  - `api_keys.organizationId`
  - `api_keys.keyPrefix`
  - `external_customers.organizationId`
  - `external_customers.externalId`
  - `cart_tryon_sessions.organizationId`
  - `cart_tryon_sessions.cartId`
  - `webhooks.organizationId`

### Environment Variables
- [ ] `AWS_REGION` - Set to deployment region
- [ ] `S3_BUCKET_NAME` - Configured for enterprise storage
- [ ] `AWS_ACCESS_KEY_ID` - Service account with S3/EventBridge access
- [ ] `AWS_SECRET_ACCESS_KEY` - Corresponding secret
- [ ] `EVENTBRIDGE_BUS_NAME` - Try-on event bus name
- [ ] `DATABASE_URL` - MySQL connection string
- [ ] `NODE_ENV=production`

### AWS Infrastructure
- [ ] S3 bucket exists with CORS configured
- [ ] S3 bucket has enterprise-specific paths:
  - `enterprise/org-{orgId}/photos/`
  - `enterprise/org-{orgId}/garments/`
- [ ] EventBridge bus configured for try-on events
- [ ] Lambda functions have necessary permissions
- [ ] CloudWatch logging enabled
- [ ] IAM roles configured for API server

## Deployment Steps

### 1. Database Migration
```bash
# Run Drizzle migrations
npm run db:migrate

# Verify tables created
npm run db:studio
```

### 2. Build Application
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test -- tests/enterprise/
```

### 3. Deploy Backend
```bash
# Option A: Docker deployment
docker build -f Dockerfile.api -t garmaxai-api:latest .
docker push garmaxai-api:latest

# Option B: PM2 deployment
pm2 start dist/index.js --name garmaxai-api
pm2 save
```

### 4. Verify Deployment
```bash
# Health check
curl https://api.garmaxai.com/health

# Test API key creation (requires JWT)
curl -X POST https://api.garmaxai.com/api/organizations \
  -H "Authorization: Bearer <jwt>" \
  -d '{"name":"Test Org","billingEmail":"test@example.com"}'
```

## Post-Deployment Testing

### Smoke Tests

1. **Organization Creation**
```bash
POST /api/organizations
Expected: 201 Created
```

2. **API Key Generation**
```bash
POST /api/organizations/{orgId}/api-keys
Expected: 201 Created, returns full key
```

3. **Customer Creation**
```bash
POST /api/v1/customers
X-API-Key: <generated_key>
Expected: 201 Created
```

4. **Photo Upload**
```bash
POST /api/v1/customers/{externalId}/photos
X-API-Key: <key>
Expected: 200 OK, returns S3 URL
```

5. **Cart Try-On Session**
```bash
POST /api/v1/cart-tryons
X-API-Key: <key>
Expected: 201 Created, credits deducted
```

6. **Webhook Configuration**
```bash
POST /api/v1/webhooks
X-API-Key: <key>
Expected: 201 Created, returns secret
```

### Integration Tests

1. **End-to-End Flow**
   - Create organization
   - Generate API key
   - Upload customer photo
   - Create cart try-on (2 items)
   - Verify credits deducted
   - Check session status
   - Verify webhook delivery

2. **Error Scenarios**
   - Invalid API key (401)
   - Insufficient credits (403)
   - Rate limit exceeded (429)
   - Invalid input (400)

3. **Webhook Testing**
   - Test webhook endpoint
   - Verify signature
   - Trigger real event
   - Check retry logic

## Monitoring Setup

### CloudWatch Alarms

1. **API Health**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name enterprise-api-5xx-errors \
  --metric-name 5XXError \
  --threshold 10 \
  --evaluation-periods 2
```

2. **Rate Limiting**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name enterprise-api-rate-limit-exceeded \
  --metric-name RateLimitExceeded \
  --threshold 100 \
  --evaluation-periods 1
```

3. **Webhook Failures**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name enterprise-webhook-failures \
  --metric-name WebhookFailure \
  --threshold 50 \
  --evaluation-periods 2
```

### Metrics to Track

1. **API Metrics**
   - Request count per endpoint
   - Average response time
   - Error rate (4xx, 5xx)
   - Rate limit hits

2. **Credit Metrics**
   - Credits consumed per hour
   - Average credits per session
   - Organizations low on credits
   - Credit refund rate

3. **Webhook Metrics**
   - Delivery success rate
   - Average delivery time
   - Retry count
   - Auto-disabled webhooks

4. **Session Metrics**
   - Cart try-on completion rate
   - Average processing time
   - Items per cart (average)
   - Quality distribution (SD/HD/4K)

## Documentation Deployment

### Public Documentation
- [ ] Deploy ENTERPRISE_API.md to docs site
- [ ] Deploy ENTERPRISE_API_QUICKREF.md
- [ ] Generate OpenAPI spec from swagger.config.js
- [ ] Create interactive API explorer (Swagger UI)

### Internal Documentation
- [ ] Update team wiki with deployment info
- [ ] Document monitoring dashboards
- [ ] Create runbook for common issues
- [ ] Document rollback procedure

## Customer Onboarding

### Initial Setup for First Customer

1. **Create Organization**
   - Use admin panel or API
   - Set initial credit balance (e.g., 100 credits)

2. **Generate API Key**
   - Full access (`all` scope) for testing
   - Set rate limit (e.g., 120 req/min)
   - No expiration for production keys

3. **Provide Documentation**
   - Send ENTERPRISE_API.md
   - Send ENTERPRISE_API_QUICKREF.md
   - Share code examples for their stack

4. **Setup Webhook**
   - Help configure their webhook endpoint
   - Verify signature implementation
   - Test with sample events

5. **Trial Session**
   - Walk through photo upload
   - Create sample cart try-on
   - Verify webhook delivery
   - Review results

### Support Setup
- [ ] Create support email (enterprise@garmaxai.com)
- [ ] Setup status page (status.garmaxai.com)
- [ ] Create Slack channel for enterprise customers
- [ ] Document escalation procedure

## Rollback Plan

### If Issues Arise

1. **Database Rollback**
```bash
# Revert migrations
npm run db:rollback

# Verify data integrity
npm run db:verify
```

2. **Application Rollback**
```bash
# Docker
docker pull garmaxai-api:previous-version
docker-compose up -d

# PM2
pm2 stop garmaxai-api
pm2 start previous-version/dist/index.js
```

3. **Feature Flag Disable**
```javascript
// In parameters/config.ts
export const FEATURE_FLAGS = {
  enableEnterpriseAPI: false
};
```

4. **Communication**
   - Notify affected customers
   - Provide ETA for resolution
   - Offer credit compensation if needed

## Performance Tuning

### Database Optimization
- [ ] Add connection pooling (min: 5, max: 20)
- [ ] Enable query caching
- [ ] Add read replicas for heavy read operations
- [ ] Implement query performance monitoring

### API Optimization
- [ ] Enable gzip compression
- [ ] Add CDN for static assets
- [ ] Implement response caching where appropriate
- [ ] Use keep-alive connections

### Webhook Optimization
- [ ] Batch webhook deliveries (10 per batch)
- [ ] Use connection pooling for outbound requests
- [ ] Implement circuit breaker for failing webhooks
- [ ] Monitor delivery latency

## Security Hardening

### Pre-Production
- [ ] Run security audit (npm audit)
- [ ] Update dependencies to latest patches
- [ ] Enable HTTPS only
- [ ] Set security headers (HSTS, CSP, etc.)
- [ ] Implement IP whitelisting (optional)
- [ ] Enable DDoS protection (AWS Shield)

### Post-Production
- [ ] Monitor for unusual activity
- [ ] Review API key usage patterns
- [ ] Audit webhook endpoints
- [ ] Check for leaked credentials
- [ ] Review access logs

## Compliance

### Data Protection
- [ ] GDPR compliance check
- [ ] Data retention policies configured
- [ ] User data deletion process
- [ ] Privacy policy updated

### Terms of Service
- [ ] Enterprise API terms drafted
- [ ] Rate limit policies documented
- [ ] Credit refund policy defined
- [ ] SLA commitments documented

## Launch Checklist

### Day Before Launch
- [x] All tests passing
- [x] Documentation complete
- [ ] Monitoring configured
- [ ] Support team trained
- [ ] Database optimized
- [ ] Backups verified

### Launch Day
- [ ] Deploy to production
- [ ] Run smoke tests
- [ ] Monitor metrics closely
- [ ] First customer onboarding
- [ ] Announce launch

### Week After Launch
- [ ] Review error logs
- [ ] Analyze usage patterns
- [ ] Collect customer feedback
- [ ] Optimize based on metrics
- [ ] Plan improvements

## Success Metrics

### Week 1
- Zero critical bugs
- 99.9% uptime
- < 500ms average response time
- Customer successfully integrated

### Month 1
- 5+ active organizations
- 1000+ API calls per day
- 95%+ webhook delivery success
- Customer satisfaction > 4/5

### Quarter 1
- 20+ active organizations
- 10,000+ API calls per day
- Revenue positive
- Feature requests documented

---

**Deployment Owner:** _____________
**Deployment Date:** _____________
**Sign-off:** _____________

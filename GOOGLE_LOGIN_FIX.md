# Google Login Fix - Production Deployment Guide

## Issue Summary

**Problem:** Google login was failing in production due to missing environment variables.

**Root Cause:** The API Lambda function was missing two critical environment variables required for Google OAuth flow:
- `COGNITO_DOMAIN` - Needed for Cognito token exchange endpoint
- `FRONTEND_URL` - Needed for OAuth callback redirect URI

**Impact:** Users attempting to sign in with Google received "Server configuration error" messages.

---

## Changes Made

### 1. Infrastructure Changes (iac/lib/stacks/BackendStack.ts)

Added missing environment variables to the API Lambda configuration:

```typescript
pythonLambda.addEnvironment('COGNITO_DOMAIN', this.cognitoDomain.domainName);
pythonLambda.addEnvironment('FRONTEND_URL', `https://${props.envConfig.frontendDomainName}`);
```

**Values in Production:**
- `COGNITO_DOMAIN`: `garmaxai-prod.auth.us-east-1.amazoncognito.com`
- `FRONTEND_URL`: `https://garmaxai.com`

### 2. Enhanced Error Logging (src/controllers/oauthController.ts)

Improved error messages to help diagnose configuration issues:

```typescript
if (!COGNITO_DOMAIN || !CLIENT_ID) {
  logger.error(
    `Missing Cognito configuration for Google login: hasCognitoDomain=${!!COGNITO_DOMAIN}, hasClientId=${!!CLIENT_ID}`,
    'AuthController'
  );
  return res.status(500).json({ message: 'Server configuration error' });
}

if (!process.env.FRONTEND_URL) {
  logger.error('Missing FRONTEND_URL configuration', 'AuthController');
  return res.status(500).json({ message: 'Server configuration error' });
}
```

---

## Deployment Steps

### 1. Deploy Infrastructure Changes

```bash
cd iac
npm install
npm run build

# Deploy to production
cdk deploy BackendStack-prod --require-approval never
```

**Expected Output:**
- Lambda environment variables updated
- No downtime (Lambda updates are atomic)
- Changes take effect immediately for new Lambda invocations

### 2. Verify Environment Variables

After deployment, verify the Lambda has the correct environment variables:

```bash
aws lambda get-function-configuration \
  --function-name GarmaxLambda \
  --query 'Environment.Variables' \
  --output json
```

**Expected to see:**
```json
{
  "COGNITO_DOMAIN": "garmaxai-prod.auth.us-east-1.amazoncognito.com",
  "FRONTEND_URL": "https://garmaxai.com",
  "COGNITO_CLIENT_ID": "<client-id>",
  "COGNITO_USER_POOL_ID": "<pool-id>",
  // ... other variables
}
```

### 3. Test Google Login

**Manual Testing:**
1. Go to https://garmaxai.com/login
2. Click "Continue with Google"
3. Should redirect to Google sign-in page
4. After Google authentication, should redirect back to app with user logged in

**Expected Flow:**
- Click "Continue with Google" → redirects to `https://garmaxai-prod.auth.us-east-1.amazoncognito.com/oauth2/authorize?...`
- Google sign-in → redirects to Cognito
- Cognito → redirects to `https://garmaxai.com/auth/callback?code=...`
- Frontend exchanges code for tokens via backend
- User is logged in

### 4. Monitor Logs

Watch CloudWatch logs for any errors:

```bash
# API Lambda logs
aws logs tail /aws/lambda/GarmaxLambda --follow --format short

# Look for successful OAuth exchanges
# Should see: "OAuth login successful for user: <email>"
```

---

## Verification Checklist

- [ ] CDK deployment completed successfully
- [ ] Lambda environment variables updated (verified with AWS CLI)
- [ ] Google login button loads auth URL correctly
- [ ] Google OAuth flow completes without errors
- [ ] User can successfully log in with Google account
- [ ] New user accounts are created properly
- [ ] Existing Google users can log in
- [ ] No errors in CloudWatch logs

---

## Rollback Plan

If issues occur, rollback is straightforward:

### Option 1: Revert Code Changes
```bash
git revert HEAD
git push
cd iac
cdk deploy BackendStack-prod
```

### Option 2: Manual Environment Variable Update
```bash
aws lambda update-function-configuration \
  --function-name GarmaxLambda \
  --environment Variables="{...previous-values...}"
```

---

## Testing in Lower Environments

Before deploying to production, test in QA:

```bash
cd iac
cdk deploy BackendStack-qa
```

**QA Environment Values:**
- `COGNITO_DOMAIN`: `garmaxai-qa.auth.us-east-1.amazoncognito.com`
- `FRONTEND_URL`: `https://qa.garmaxai.com`

---

## Configuration Reference

### Environment-Specific Values

| Environment | COGNITO_DOMAIN | FRONTEND_URL |
|-------------|----------------|--------------|
| DEV | `garmaxai-dev.auth.us-east-1.amazoncognito.com` | `https://dev.garmaxai.com` |
| QA | `garmaxai-qa.auth.us-east-1.amazoncognito.com` | `https://qa.garmaxai.com` |
| PROD | `garmaxai-prod.auth.us-east-1.amazoncognito.com` | `https://garmaxai.com` |

### How Environment Variables Are Set

The values come from the CDK stack configuration:

```typescript
// In BackendStack.ts
this.cognitoDomain = userPool.addDomain(`GarmaxAi-CognitoDomain-${stage}`, {
  cognitoDomain: {
    domainPrefix: `garmaxai-${stage}`,
  },
});

// Results in:
// - DEV: garmaxai-dev.auth.us-east-1.amazoncognito.com
// - QA: garmaxai-qa.auth.us-east-1.amazoncognito.com  
// - PROD: garmaxai-prod.auth.us-east-1.amazoncognito.com

// Frontend URL comes from envConfig
props.envConfig.frontendDomainName
// - DEV: dev.garmaxai.com
// - QA: qa.garmaxai.com
// - PROD: garmaxai.com
```

---

## Common Issues & Solutions

### Issue: "Server configuration error" persists after deployment

**Possible Causes:**
1. Lambda is using cached environment (cold start hasn't happened yet)
2. Deployment didn't complete successfully
3. Wrong Lambda function was updated

**Solution:**
```bash
# Force Lambda to use new environment by invoking it
aws lambda invoke \
  --function-name GarmaxLambda \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  response.json

# Check environment variables
aws lambda get-function-configuration \
  --function-name GarmaxLambda \
  --query 'Environment.Variables'
```

### Issue: OAuth redirect goes to localhost

**Cause:** `FRONTEND_URL` not set or set incorrectly

**Solution:**
```bash
# Verify value
aws lambda get-function-configuration \
  --function-name GarmaxLambda \
  --query 'Environment.Variables.FRONTEND_URL'

# Should return: "https://garmaxai.com" (for prod)
```

### Issue: Token exchange fails

**Cause:** `COGNITO_DOMAIN` not set or incorrect

**Solution:**
```bash
# Verify value
aws lambda get-function-configuration \
  --function-name GarmaxLambda \
  --query 'Environment.Variables.COGNITO_DOMAIN'

# Should return: "garmaxai-prod.auth.us-east-1.amazoncognito.com"
```

---

## Success Metrics

After deployment, monitor these metrics:

1. **Google Login Attempts:** Should increase with no failures
2. **OAuth Errors:** Should drop to zero
3. **New User Signups via Google:** Should resume normal rate
4. **CloudWatch Error Logs:** No "Missing Cognito configuration" errors

---

## Support

If issues persist after deployment:

1. Check CloudWatch logs: `/aws/lambda/GarmaxLambda`
2. Verify Cognito configuration in AWS Console
3. Test OAuth flow manually with curl:
   ```bash
   curl https://be.garmaxai.com/api/auth/oauth/google
   # Should return: {"authUrl":"https://garmaxai-prod.auth..."}
   ```

4. Contact: devops@garmaxai.com

---

## Related Documentation

- [GOOGLE_SSO_SETUP.md](GOOGLE_SSO_SETUP.md) - Initial Google OAuth setup
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - General deployment procedures
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)

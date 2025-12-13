# Authentication Testing Suite

Comprehensive testing suite for authentication workflows in GarmaxAi, with special focus on Google OAuth sign-in and production environment validation.

## Overview

This testing suite ensures all authentication flows work correctly:
- Email/Password registration and login
- Google OAuth sign-in
- Token lifecycle management
- Session handling
- Protected route access
- Trial and credit management

## Test Files

### 1. OAuth Integration Tests (`tests/auth/oauth.test.ts`)

Tests Google OAuth flow end-to-end:

**Coverage:**
- OAuth URL generation
- Authorization callback handling
- Token exchange with Cognito
- User creation from OAuth
- Existing user OAuth login
- Error scenarios (invalid codes, missing env vars, network failures)
- Profile information handling

**Run:**
```bash
npm run test:auth
# or
npm test -- tests/auth/oauth.test.ts
```

### 2. Middleware Unit Tests (`tests/middleware/auth.test.ts`)

Tests authentication middleware functions:

**Coverage:**
- `authenticateToken` - JWT validation and user attachment
- `optionalAuth` - Optional authentication for public routes
- `requireActiveTrial` - Trial status verification
- `requireCredits` - Credit requirement checks
- Token expiration handling
- Error cases (missing tokens, invalid formats, database errors)

**Run:**
```bash
npm run test:middleware
# or
npm test -- tests/middleware/auth.test.ts
```

### 3. Token Lifecycle Tests (`tests/auth/token-lifecycle.test.ts`)

Tests token management throughout their lifecycle:

**Coverage:**
- Token expiration handling
- Token storage and retrieval
- Session persistence
- Concurrent token usage
- Token security (tampering, replay attacks)
- Edge cases (large payloads, special characters, clock skew)
- Refresh token flow (documented for future implementation)

**Run:**
```bash
npm test -- tests/auth/token-lifecycle.test.ts
```

### 4. End-to-End Auth Flow Tests (`tests/e2e/auth-flow.test.ts`)

Tests complete user journeys:

**Coverage:**
- Full registration → login → logout flow
- Complete Google OAuth journey
- Trial creation and expiration
- Protected route access patterns
- Multi-session handling
- Error recovery scenarios
- Edge cases (duplicate emails, invalid credentials, validation)

**Run:**
```bash
npm run test:e2e
# or
npm test -- tests/e2e/auth-flow.test.ts
```

### 5. Production Validation Script (`scripts/test-production-auth.ts`)

Validates authentication in production environment:

**Checks:**
- Environment variable configuration
- OAuth URL generation
- Callback endpoint accessibility
- Cognito domain connectivity
- Email/password login endpoint
- Protected endpoint authentication
- CORS configuration
- Logout endpoint

**Run:**
```bash
npm run test:prod-auth

# With custom environment
API_BASE_URL=https://be.garmaxai.com npm run test:prod-auth

# For different stages
ENVIRONMENT=QA API_BASE_URL=https://be-qa.garmaxai.com npm run test:prod-auth
```

**Output:**
- ✓ Pass/Fail for each check
- Detailed error messages
- Configuration validation
- Summary report
- Exit code (0 = success, 1 = failure)

## Running Tests

### Run All Authentication Tests
```bash
npm run test:auth
```

### Run All Tests (including frontend and e2e)
```bash
npm run test:all
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm test -- tests/auth/oauth.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="OAuth"
```

## Production Validation

Before deploying or when investigating production issues:

```bash
# Validate production authentication
npm run test:prod-auth

# Check specific environment
ENVIRONMENT=PROD \
API_BASE_URL=https://be.garmaxai.com \
FRONTEND_URL=https://garmaxai.com \
npm run test:prod-auth
```

**Expected Output:**
```
================================================================================
PRODUCTION AUTHENTICATION VALIDATION
================================================================================

[2025-12-11T...] ℹ Starting validation for PROD environment...
[2025-12-11T...] ℹ API Base URL: https://api.garmaxai.com
[2025-12-11T...] ℹ Frontend URL: https://garmaxai.com

[2025-12-11T...] ✓ Environment Variables: Cognito configuration detected
[2025-12-11T...] ✓ OAuth URL Generation: OAuth URL structure is valid
[2025-12-11T...] ✓ Callback Endpoint: Callback endpoint is accessible
[2025-12-11T...] ✓ Cognito Connectivity: Successfully connected to Cognito
[2025-12-11T...] ✓ Email/Password Login: Login endpoint is accessible
[2025-12-11T...] ✓ Authentication Protection: Protected endpoints require auth
[2025-12-11T...] ✓ CORS Configuration: CORS headers are configured
[2025-12-11T...] ✓ Logout Endpoint: Logout endpoint is accessible

================================================================================
✓ Passed: 8/8
✗ Failed: 0/8
================================================================================
```

## Test Coverage

Current authentication test coverage:

| Component | Coverage | Tests |
|-----------|----------|-------|
| OAuth Flow | ✅ Complete | 15+ tests |
| Middleware | ✅ Complete | 25+ tests |
| Token Lifecycle | ✅ Complete | 20+ tests |
| E2E Flows | ✅ Complete | 25+ tests |
| Production Validation | ✅ Complete | 8 checks |

**Total:** 85+ automated tests + production validation

## Environment Variables

Required for tests:

```bash
# Test environment
NODE_ENV=test
COGNITO_USER_POOL_ID=us-east-1_test123456
COGNITO_CLIENT_ID=test-client-id-123456
COGNITO_DOMAIN=garmaxai-test.auth.us-east-1.amazoncognito.com
AWS_REGION=us-east-1
FRONTEND_URL=http://localhost:5001
```

Required for production validation:

```bash
# Production
ENVIRONMENT=PROD
API_BASE_URL=https://be.garmaxai.com
FRONTEND_URL=https://garmaxai.com

# QA
ENVIRONMENT=QA
API_BASE_URL=https://be-qa.garmaxai.com
FRONTEND_URL=https://qa.garmaxai.com

# Dev
ENVIRONMENT=DEV
API_BASE_URL=https://be-dev.garmaxai.com
FRONTEND_URL=https://dev.garmaxai.com
```

## Known Issues & Limitations

### Current Implementation
- **Token Revocation:** No token revocation mechanism (tokens valid until expiration)
- **Refresh Tokens:** Refresh token flow not yet implemented (tests document expected behavior)

### Security Features Implemented
- ✅ **JWT Signature Verification:** All tokens are cryptographically verified against Cognito's JWKS
- ✅ **Issuer Validation:** Tokens verified to come from correct Cognito User Pool
- ✅ **Audience Validation:** Tokens validated for correct client/application
- ✅ **Key Caching:** Public keys cached for 24 hours with automatic rotation support
- ✅ **Algorithm Validation:** Only RS256 (Cognito standard) accepted

### Future Enhancements
1. **Token Refresh:** Implement `/api/auth/refresh` endpoint using Cognito's `REFRESH_TOKEN_AUTH`
2. **Token Revocation:** Add token blacklist or revocation list for immediate logout
3. **MFA Support:** Add tests for multi-factor authentication flows
4. **Social Providers:** Extend OAuth tests for additional providers (Facebook, Apple)

## Troubleshooting

### Tests Failing Locally

1. **Database Connection Issues:**
   ```bash
   # Check if test database is running
   docker ps | grep mysql
   
   # Reset test database
   npm run db:push
   ```

2. **Environment Variables Missing:**
   ```bash
   # Check .env.test file exists
   cat .env.test
   
   # Source environment
   source .env.test
   ```

3. **Port Conflicts:**
   ```bash
   # Check if ports 5000/5001 are in use
   lsof -i :5000
   lsof -i :5001
   ```

### Production Validation Failing

1. **Environment Variables:**
   - Verify Lambda has correct Cognito configuration
   - Check CloudFormation outputs for actual values
   - Ensure `COGNITO_DOMAIN` and `FRONTEND_URL` are set

2. **Network Issues:**
   - Check VPC/Security Group configuration
   - Verify API Gateway is publicly accessible
   - Test Cognito connectivity from Lambda

3. **OAuth Configuration:**
   - Verify Cognito User Pool callback URLs
   - Check Google OAuth client configuration
   - Ensure redirect URIs match exactly

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Authentication Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run authentication tests
        run: npm run test:auth
        env:
          NODE_ENV: test
          COGNITO_USER_POOL_ID: ${{ secrets.TEST_COGNITO_POOL_ID }}
          COGNITO_CLIENT_ID: ${{ secrets.TEST_COGNITO_CLIENT_ID }}
      
      - name: Validate production auth
        if: github.ref == 'refs/heads/main'
        run: npm run test:prod-auth
        env:
          API_BASE_URL: https://be.garmaxai.com
          FRONTEND_URL: https://garmaxai.com
```

## Additional Resources

- [Google OAuth Setup Guide](../GOOGLE_SSO_SETUP.md)
- [Google Login Fix Documentation](../GOOGLE_LOGIN_FIX.md)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## Contributing

When adding new authentication features:

1. Add unit tests in appropriate test file
2. Add integration test in `oauth.test.ts` or `auth.test.ts`
3. Add E2E test in `auth-flow.test.ts`
4. Update production validation script if needed
5. Document new environment variables
6. Update this README

## Support

For issues with authentication:
1. Run production validation: `npm run test:prod-auth`
2. Check test coverage: `npm run test:coverage`
3. Review logs in CloudWatch
4. Check Cognito User Pool settings
5. Verify environment configuration

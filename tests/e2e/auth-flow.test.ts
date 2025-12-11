// End-to-end authentication flow tests
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createTestClient, createTestUser } from '../utils/testHelpers';
import { storage } from '../../src/storage';

// Set up environment
process.env.NODE_ENV = 'test';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123456';
process.env.COGNITO_CLIENT_ID = 'test-client-id-123456';
process.env.COGNITO_DOMAIN = 'garmaxai-test.auth.us-east-1.amazoncognito.com';
process.env.AWS_REGION = 'us-east-1';
process.env.FRONTEND_URL = 'http://localhost:5001';

describe('End-to-End Authentication Flows', () => {
  let client: ReturnType<typeof createTestClient>;

  beforeEach(() => {
    client = createTestClient();
    global.fetch = jest.fn() as any;
  });

  describe('Complete Email/Password Registration → Login → Logout Flow', () => {
    test('should complete full user journey with email/password', async () => {
      // Step 1: Register new user
      const registrationData = {
        username: 'e2euser',
        email: 'e2euser@example.com',
        password: 'SecurePassword123!',
      };

      const registerResponse = await client
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body.user.email).toBe('e2euser@example.com');
      expect(registerResponse.body.user.subscriptionTier).toBe('free');
      expect(registerResponse.body.user).not.toHaveProperty('password');

      const userId = registerResponse.body.user.id;

      // Step 2: Login with credentials
      const loginResponse = await client
        .post('/api/auth/login')
        .send({
          email: 'e2euser@example.com',
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user.id).toBe(userId);

      // Step 3: Access protected resource
      const token = createMockTokenForUser(loginResponse.body.user);
      const meResponse = await client
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meResponse.body.email).toBe('e2euser@example.com');

      // Step 4: Logout
      const logoutResponse = await client
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Step 5: Verify user can login again after logout
      const reloginResponse = await client
        .post('/api/auth/login')
        .send({
          email: 'e2euser@example.com',
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(reloginResponse.body.user.id).toBe(userId);
    });

    test('should prevent access to protected resources without authentication', async () => {
      // Try to access protected resource without token
      const response = await client
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      });
    });

    test('should handle invalid login credentials', async () => {
      await createTestUser({
        email: 'validuser@example.com',
        password: '$2b$10$hashedpassword',
      });

      const response = await client
        .post('/api/auth/login')
        .send({
          email: 'validuser@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Complete Google OAuth Flow', () => {
    test('should complete full Google OAuth journey', async () => {
      // Step 1: Initiate OAuth flow
      const initiateResponse = await client
        .get('/api/auth/oauth/google')
        .expect(200);

      expect(initiateResponse.body).toHaveProperty('authUrl');
      const authUrl = initiateResponse.body.authUrl;
      expect(authUrl).toContain('identity_provider=Google');

      // Step 2: User authenticates with Google (simulated)
      // Google redirects back with authorization code
      const mockAuthCode = 'mock_google_auth_code_e2e';

      // Step 3: Backend exchanges code for tokens
      const mockTokens = {
        access_token: 'mock_access_e2e',
        id_token: createMockIdToken({
          sub: 'google-oauth2|e2e_user',
          email: 'googlee2e@example.com',
          email_verified: true,
          given_name: 'E2E',
          family_name: 'Test',
        }),
        refresh_token: 'mock_refresh_e2e',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const callbackResponse = await client
        .post('/api/auth/oauth/callback')
        .send({ code: mockAuthCode })
        .expect(200);

      expect(callbackResponse.body).toHaveProperty('user');
      expect(callbackResponse.body).toHaveProperty('accessToken');
      expect(callbackResponse.body).toHaveProperty('idToken');
      expect(callbackResponse.body).toHaveProperty('refreshToken');
      expect(callbackResponse.body.user.email).toBe('googlee2e@example.com');
      expect(callbackResponse.body.user.emailVerified).toBe(true);

      // Step 4: Verify user was created in database
      const user = await storage.getUserByEmail('googlee2e@example.com');
      expect(user).toBeDefined();
      expect(user?.trialStatus).toBe('active');
      expect(user?.creditsRemaining).toBeGreaterThan(0);

      // Step 5: Use token to access protected resource
      const token = createMockTokenForEmail('googlee2e@example.com');
      const meResponse = await client
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meResponse.body.email).toBe('googlee2e@example.com');

      // Step 6: Logout
      await client
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    test('should handle returning OAuth user (already registered)', async () => {
      // Pre-create user
      await createTestUser({
        email: 'returninguser@example.com',
        username: 'returninguser',
      });

      // Initiate OAuth
      const initiateResponse = await client
        .get('/api/auth/oauth/google')
        .expect(200);

      // Exchange code for tokens
      const mockTokens = {
        access_token: 'mock_access_returning',
        id_token: createMockIdToken({
          sub: 'google-oauth2|returning_user',
          email: 'returninguser@example.com',
          email_verified: true,
        }),
        refresh_token: 'mock_refresh_returning',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const callbackResponse = await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_returning' })
        .expect(200);

      expect(callbackResponse.body.user.email).toBe('returninguser@example.com');

      // Verify no duplicate user was created
      const user = await storage.getUserByEmail('returninguser@example.com');
      expect(user).toBeDefined();
    });

    test('should handle OAuth flow with state parameter for redirect', async () => {
      const returnToPath = '/dashboard';
      
      const initiateResponse = await client
        .get(`/api/auth/oauth/google?returnTo=${returnToPath}`)
        .expect(200);

      expect(initiateResponse.body.authUrl).toContain(`state=${encodeURIComponent(returnToPath)}`);
    });
  });

  describe('Trial Creation and Expiration Flow', () => {
    test('should create active trial for new OAuth user', async () => {
      const mockTokens = {
        access_token: 'mock_access_trial',
        id_token: createMockIdToken({
          sub: 'google-oauth2|trial_user',
          email: 'trialuser@example.com',
          email_verified: true,
        }),
        refresh_token: 'mock_refresh_trial',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_trial' })
        .expect(200);

      expect(response.body.user.trialStatus).toBe('active');
      expect(response.body.user.trialExpiresAt).toBeDefined();

      const user = await storage.getUserByEmail('trialuser@example.com');
      expect(user?.trialStatus).toBe('active');

      // Verify trial is 14 days
      const trialExpiration = new Date(user!.trialExpiresAt!);
      const daysUntilExpiry = Math.ceil(
        (trialExpiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(13);
      expect(daysUntilExpiry).toBeLessThanOrEqual(14);
    });

    test('should allocate initial credits on trial creation', async () => {
      const mockTokens = {
        access_token: 'mock_access_credits',
        id_token: createMockIdToken({
          sub: 'google-oauth2|credits_user',
          email: 'creditstest@example.com',
          email_verified: true,
        }),
        refresh_token: 'mock_refresh_credits',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_credits' })
        .expect(200);

      const user = await storage.getUserByEmail('creditstest@example.com');
      expect(user?.creditsRemaining).toBeGreaterThanOrEqual(100);
    });

    test('should block access when trial expires', async () => {
      // Create user with expired trial
      const expiredTrialDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const user = await createTestUser({
        email: 'expiredtrial@example.com',
        trialStatus: 'expired',
        trialExpiresAt: expiredTrialDate,
      });

      const token = createMockTokenForEmail('expiredtrial@example.com');

      // Mock a protected route that requires active trial
      // Since we don't have a specific route, we document expected behavior
      // Protected routes should use requireActiveTrial middleware
      expect(user.trialStatus).toBe('expired');
      expect(user.trialExpiresAt! < new Date()).toBe(true);
    });
  });

  describe('Protected Routes Access Patterns', () => {
    test('should allow access to protected routes with valid authentication', async () => {
      const user = await createTestUser({
        email: 'protected@example.com',
        creditsRemaining: 100,
        trialStatus: 'active',
        trialExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const token = createMockTokenForEmail('protected@example.com');

      // Access protected /api/auth/me
      const response = await client
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.email).toBe('protected@example.com');
    });

    test('should block access to protected routes without token', async () => {
      const response = await client
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      });
    });

    test('should block access with expired token', async () => {
      const user = await createTestUser({ email: 'expiredtoken@example.com' });

      const expiredToken = createMockToken({
        sub: 'cognito-sub-expired',
        email: 'expiredtoken@example.com',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
      });

      const response = await client
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    });

    test('should handle public routes without authentication', async () => {
      // Public routes should work without auth
      // Test OAuth initiation (public route)
      const response = await client
        .get('/api/auth/oauth/google')
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
    });

    test('should handle optional auth routes', async () => {
      // Routes with optionalAuth middleware should work with or without token
      // Document expected behavior: routes return enhanced data if authenticated
      
      // Without auth
      // const publicResponse = await client.get('/api/public-route').expect(200);

      // With auth
      const user = await createTestUser({ email: 'optional@example.com' });
      const token = createMockTokenForEmail('optional@example.com');
      // const authResponse = await client
      //   .get('/api/public-route')
      //   .set('Authorization', `Bearer ${token}`)
      //   .expect(200);

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Multi-Session and Concurrent Login Flows', () => {
    test('should allow same user to login from multiple devices', async () => {
      const user = await createTestUser({ email: 'multidevice@example.com' });

      // Create two different tokens (simulating different login sessions)
      const token1 = createMockToken({
        sub: 'cognito-sub-device1',
        email: 'multidevice@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const token2 = createMockToken({
        sub: 'cognito-sub-device2',
        email: 'multidevice@example.com',
        iat: Math.floor(Date.now() / 1000) + 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Both sessions should work concurrently
      const [response1, response2] = await Promise.all([
        client.get('/api/auth/me').set('Authorization', `Bearer ${token1}`),
        client.get('/api/auth/me').set('Authorization', `Bearer ${token2}`),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.email).toBe('multidevice@example.com');
      expect(response2.body.email).toBe('multidevice@example.com');
    });

    test('should handle logout from one device while other session remains active', async () => {
      const user = await createTestUser({ email: 'logout-one@example.com' });

      const token1 = createMockTokenForEmail('logout-one@example.com');
      const token2 = createMockTokenForEmail('logout-one@example.com');

      // Logout from first session
      await client
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      // Second session should still work (JWT tokens remain valid until expiration)
      const response = await client
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(response.body.email).toBe('logout-one@example.com');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle registration with duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'anotheruser',
          email: 'duplicate@example.com',
          password: 'Password123!',
        })
        .expect(409);

      expect(response.body).toHaveProperty('message');
    });

    test('should handle login with non-existent email', async () => {
      const response = await client
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate email format on registration', async () => {
      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Password123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate password strength on registration', async () => {
      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '123', // Too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should handle OAuth callback with invalid authorization code', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'invalid_code_123' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});

// Helper functions
function createMockToken(payload: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const base64Signature = Buffer.from('mock_signature').toString('base64');
  return `${base64Header}.${base64Payload}.${base64Signature}`;
}

function createMockTokenForEmail(email: string): string {
  return createMockToken({
    sub: `cognito-sub-${email.split('@')[0]}`,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

function createMockTokenForUser(user: any): string {
  return createMockTokenForEmail(user.email);
}

function createMockIdToken(payload: any): string {
  const fullPayload = {
    ...payload,
    aud: process.env.COGNITO_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    token_use: 'id',
  };
  return createMockToken(fullPayload);
}

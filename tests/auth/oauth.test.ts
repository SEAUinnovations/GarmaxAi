// OAuth integration tests - Google Sign-In flow
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createTestClient } from '../utils/testHelpers';
import { storage } from '../../src/storage';

// Set up environment variables before imports
process.env.NODE_ENV = 'test';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123456';
process.env.COGNITO_CLIENT_ID = 'test-client-id-123456';
process.env.COGNITO_DOMAIN = 'garmaxai-test.auth.us-east-1.amazoncognito.com';
process.env.AWS_REGION = 'us-east-1';
process.env.FRONTEND_URL = 'http://localhost:5001';

describe('OAuth Google Sign-In Flow', () => {
  let client: ReturnType<typeof createTestClient>;

  beforeEach(() => {
    client = createTestClient();
  });

  describe('GET /api/auth/oauth/google - Initiate OAuth Flow', () => {
    test('should return Google OAuth authorization URL', async () => {
      const response = await client
        .get('/api/auth/oauth/google')
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('garmaxai-test.auth.us-east-1.amazoncognito.com');
      expect(response.body.authUrl).toContain('/oauth2/authorize');
      expect(response.body.authUrl).toContain('client_id=test-client-id-123456');
      expect(response.body.authUrl).toContain('response_type=code');
      expect(response.body.authUrl).toContain('scope=email+openid+profile');
      expect(response.body.authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5001%2Fauth%2Fcallback');
      expect(response.body.authUrl).toContain('identity_provider=Google');
    });

    test('should include state parameter when returnTo is provided', async () => {
      const response = await client
        .get('/api/auth/oauth/google?returnTo=/dashboard')
        .expect(200);

      expect(response.body.authUrl).toContain('state=%2Fdashboard');
    });

    test('should fail when COGNITO_DOMAIN is missing', async () => {
      const originalDomain = process.env.COGNITO_DOMAIN;
      delete process.env.COGNITO_DOMAIN;

      const response = await client
        .get('/api/auth/oauth/google')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Server configuration error',
      });

      process.env.COGNITO_DOMAIN = originalDomain;
    });

    test('should fail when CLIENT_ID is missing', async () => {
      const originalClientId = process.env.COGNITO_CLIENT_ID;
      delete process.env.COGNITO_CLIENT_ID;

      const response = await client
        .get('/api/auth/oauth/google')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Server configuration error',
      });

      process.env.COGNITO_CLIENT_ID = originalClientId;
    });

    test('should fail when FRONTEND_URL is missing', async () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      delete process.env.FRONTEND_URL;

      const response = await client
        .get('/api/auth/oauth/google')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Server configuration error',
      });

      process.env.FRONTEND_URL = originalFrontendUrl;
    });
  });

  describe('POST /api/auth/oauth/callback - Handle OAuth Callback', () => {
    // Mock successful token exchange
    const mockTokenResponse = {
      access_token: 'mock_access_token_123',
      id_token: createMockIdToken({
        sub: 'google-oauth2|123456789',
        email: 'googleuser@example.com',
        email_verified: true,
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      }),
      refresh_token: 'mock_refresh_token_456',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    beforeEach(() => {
      // Mock fetch for token exchange
      global.fetch = jest.fn() as any;
    });

    test('should successfully exchange authorization code for tokens', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_auth_code_123',
          redirectUri: 'http://localhost:5001/auth/callback',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken', 'mock_access_token_123');
      expect(response.body).toHaveProperty('idToken');
      expect(response.body).toHaveProperty('refreshToken', 'mock_refresh_token_456');

      expect(response.body.user).toMatchObject({
        email: 'googleuser@example.com',
        emailVerified: true,
      });

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://garmaxai-test.auth.us-east-1.amazoncognito.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    test('should create new user when OAuth login is first time', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_auth_code_new_user',
          redirectUri: 'http://localhost:5001/auth/callback',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'googleuser@example.com',
        emailVerified: true,
        subscriptionTier: 'free',
      });

      // Verify user was created with trial
      const user = await storage.getUserByEmail('googleuser@example.com');
      expect(user).toBeDefined();
      expect(user?.trialStatus).toBe('active');
      expect(user?.creditsRemaining).toBeGreaterThan(0);
    });

    test('should return existing user when OAuth email already registered', async () => {
      // Create existing user first
      await storage.createUser({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'hashed_password',
        emailVerified: false,
      });

      const existingUserToken = createMockIdToken({
        sub: 'google-oauth2|existing_user',
        email: 'existing@example.com',
        email_verified: true,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: existingUserToken,
        }),
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_auth_code_existing',
        })
        .expect(200);

      expect(response.body.user.email).toBe('existing@example.com');
      
      // Verify only one user exists with this email
      const users = await storage.getUserByEmail('existing@example.com');
      expect(users).toBeDefined();
    });

    test('should fail when authorization code is missing', async () => {
      const response = await client
        .post('/api/auth/oauth/callback')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        message: 'Missing authorization code',
      });
    });

    test('should fail when token exchange returns error', async () => {
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
        .send({
          code: 'invalid_code_123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Failed to exchange authorization code');
    });

    test('should fail when Cognito configuration is missing', async () => {
      const originalDomain = process.env.COGNITO_DOMAIN;
      delete process.env.COGNITO_DOMAIN;

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_code_123',
        })
        .expect(500);

      expect(response.body).toEqual({
        message: 'Server configuration error',
      });

      process.env.COGNITO_DOMAIN = originalDomain;
    });

    test('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_code_network_error',
        })
        .expect(500);

      expect(response.body).toEqual({
        message: 'Authentication failed',
      });
    });

    test('should handle malformed id_token gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: 'malformed.token', // Invalid JWT format
        }),
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_code_malformed_token',
        })
        .expect(500);

      expect(response.body.message).toBe('Authentication failed');
    });

    test('should use provided redirectUri in token exchange', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const customRedirectUri = 'https://custom.domain.com/auth/callback';
      
      await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_code_custom_redirect',
          redirectUri: customRedirectUri,
        })
        .expect(200);

      // Verify the redirectUri was used in the token exchange
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = fetchCall[1].body;
      expect(requestBody).toContain(`redirect_uri=${encodeURIComponent(customRedirectUri)}`);
    });

    test('should include user profile information from OAuth', async () => {
      const profileToken = createMockIdToken({
        sub: 'google-oauth2|profile_test',
        email: 'profile@example.com',
        email_verified: true,
        given_name: 'Jane',
        family_name: 'Smith',
        picture: 'https://example.com/jane.jpg',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: profileToken,
        }),
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({
          code: 'mock_code_profile',
        })
        .expect(200);

      expect(response.body.user.email).toBe('profile@example.com');
      
      // Verify user was created with profile data
      const user = await storage.getUserByEmail('profile@example.com');
      expect(user).toBeDefined();
    });
  });

  describe('OAuth User Creation Flow', () => {
    test('should set trial period for new OAuth users', async () => {
      const mockToken = createMockIdToken({
        sub: 'google-oauth2|trial_user',
        email: 'trialuser@example.com',
        email_verified: true,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: mockToken,
        }),
      });

      await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_trial' })
        .expect(200);

      const user = await storage.getUserByEmail('trialuser@example.com');
      expect(user?.trialStatus).toBe('active');
      expect(user?.trialExpiresAt).toBeDefined();
      
      // Trial should be 14 days from now
      const daysUntilExpiry = Math.ceil(
        (new Date(user!.trialExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(13);
      expect(daysUntilExpiry).toBeLessThanOrEqual(14);
    });

    test('should allocate initial credits for new OAuth users', async () => {
      const mockToken = createMockIdToken({
        sub: 'google-oauth2|credits_user',
        email: 'creditsuser@example.com',
        email_verified: true,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: mockToken,
        }),
      });

      await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_credits' })
        .expect(200);

      const user = await storage.getUserByEmail('creditsuser@example.com');
      expect(user?.creditsRemaining).toBeGreaterThanOrEqual(100);
    });

    test('should mark email as verified for OAuth users', async () => {
      const mockToken = createMockIdToken({
        sub: 'google-oauth2|verified_user',
        email: 'verified@example.com',
        email_verified: true,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTokenResponse,
          id_token: mockToken,
        }),
      });

      const response = await client
        .post('/api/auth/oauth/callback')
        .send({ code: 'mock_code_verified' })
        .expect(200);

      expect(response.body.user.emailVerified).toBe(true);
    });
  });
});

// Helper function to create mock JWT id_token
function createMockIdToken(payload: {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const fullPayload = {
    ...payload,
    aud: process.env.COGNITO_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    token_use: 'id',
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
  const base64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64');
  const base64Signature = Buffer.from('mock_signature').toString('base64');

  return `${base64Header}.${base64Payload}.${base64Signature}`;
}

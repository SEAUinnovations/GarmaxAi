// Set up environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123456';
process.env.COGNITO_CLIENT_ID = 'test-client-id-123456';
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET = 'test-bucket';
process.env.EVENTBRIDGE_BUS_NAME = 'test-event-bus';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing_only';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.DATABASE_URL = 'mysql://root:password@localhost:3306/garmaxai_test';

// Authentication API endpoint tests
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createTestClient, createTestUser } from '../utils/testHelpers';

describe('Authentication API', () => {
  let client: ReturnType<typeof createTestClient>;

  beforeEach(() => {
    client = createTestClient();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      const response = await client
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        user: {
          username: 'newuser',
          email: 'newuser@example.com',
          emailVerified: false,
          subscriptionTier: 'free',
          credits: 10,
        },
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should reject duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          email: 'existing@example.com',
          password: 'password123',
        })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });

    test('should validate email format', async () => {
      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    test('should require minimum password length', async () => {
      const response = await client
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '123',
        })
        .expect(400);

      expect(response.body.error).toContain('password');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      await createTestUser({
        email: 'login@example.com',
        password: '$2b$10$XOPbrlUPQdwdJUpSrIF6X.LbE14qsMmKGhM1A8W80xRkIiyNBcdPO', // "password123"
      });

      const response = await client
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.user.email).toBe('login@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      await createTestUser({ email: 'test@example.com' });

      const response = await client
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const response = await client
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user when authenticated', async () => {
      const user = await client.createAuthenticatedUser();

      const response = await client
        .get('/api/auth/me')
        .expect(200);

      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should return 401 when not authenticated', async () => {
      const response = await client
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toContain('authenticated');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout authenticated user', async () => {
      await client.createAuthenticatedUser();

      const response = await client
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toContain('logged out');

      // Should not be able to access protected routes
      await client
        .get('/api/auth/me')
        .expect(401);
    });

    test('should handle logout when not authenticated', async () => {
      const response = await client
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toContain('logged out');
    });
  });

  describe('POST /api/auth/start-free-trial', () => {
    test('should start free trial with valid email', async () => {
      const response = await client
        .post('/api/auth/start-free-trial')
        .send({
          email: 'trial@example.com',
        })
        .expect(200);

      expect(response.body.message).toContain('verification email sent');
    });

    test('should reject invalid email format', async () => {
      const response = await client
        .post('/api/auth/start-free-trial')
        .send({
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });
  });
});
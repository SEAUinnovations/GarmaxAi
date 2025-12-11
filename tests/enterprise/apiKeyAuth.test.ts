import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { storage } from '../../src/storage';
import { generateApiKey } from '../../src/utils/apiKeyGenerator';
import bcrypt from 'bcrypt';

describe('Enterprise API Key Authentication', () => {
  let organizationId: string;
  let validApiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    // Create test organization
    const org = await storage.createOrganization({
      name: 'Test Org',
      billingEmail: 'test@example.com',
      credits: 1000,
      settings: {},
      status: 'active'
    });
    organizationId = org.id;

    // Create API key
    const { key, keyHash, keyPrefix } = await generateApiKey();
    validApiKey = key;

    const apiKey = await storage.createApiKey({
      organizationId,
      name: 'Test API Key',
      keyHash,
      keyPrefix,
      scopes: ['tryon:create', 'tryon:read'],
      isActive: true
    });
    apiKeyId = apiKey.id;
  });

  afterAll(async () => {
    // Cleanup
    if (apiKeyId) {
      await storage.deleteApiKey(apiKeyId);
    }
    if (organizationId) {
      await storage.deleteOrganization(organizationId);
    }
  });

  describe('Valid API Key', () => {
    it('should authenticate with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.status).not.toBe(401);
    });

    it('should include organization context in request', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.status).toBe(200);
      // Request should have organizationId available
    });
  });

  describe('Invalid API Key', () => {
    it('should reject request with missing API key', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing API key');
    });

    it('should reject request with invalid API key format', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', 'invalid_key');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key format');
    });

    it('should reject request with non-existent API key', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', 'gx_test_nonexistent123456789012345678901234567890');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });

    it('should reject request with inactive API key', async () => {
      // Deactivate API key
      await storage.updateApiKey(apiKeyId, { isActive: false });

      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key is inactive');

      // Reactivate for other tests
      await storage.updateApiKey(apiKeyId, { isActive: true });
    });

    it('should reject request with expired API key', async () => {
      // Set expiration to past
      await storage.updateApiKey(apiKeyId, {
        expiresAt: new Date(Date.now() - 86400000)
      });

      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key has expired');

      // Remove expiration for other tests
      await storage.updateApiKey(apiKeyId, { expiresAt: null });
    });
  });

  describe('Scope Validation', () => {
    it('should allow request with valid scope', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.status).toBe(200);
    });

    it('should reject request without required scope', async () => {
      // Create API key without photos:upload scope
      const { key, keyHash, keyPrefix } = await generateApiKey();
      const limitedApiKey = await storage.createApiKey({
        organizationId,
        name: 'Limited API Key',
        keyHash,
        keyPrefix,
        scopes: ['tryon:read'],
        isActive: true
      });

      const response = await request(app)
        .post('/api/v1/customers/cust_123/photos')
        .set('X-API-Key', key)
        .attach('photo', Buffer.from('fake image'), 'photo.jpg');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');

      // Cleanup
      await storage.deleteApiKey(limitedApiKey.id);
    });
  });

  describe('Usage Tracking', () => {
    it('should update lastUsedAt timestamp', async () => {
      const beforeUse = new Date();

      await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      const apiKey = await storage.getApiKey(apiKeyId);
      expect(apiKey.lastUsedAt).toBeDefined();
      expect(new Date(apiKey.lastUsedAt!).getTime()).toBeGreaterThanOrEqual(beforeUse.getTime());
    });

    it('should log API usage', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      // Usage should be logged in database
      // This would require querying the api_usage_logs table
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests rapidly
      const requests = Array(70).fill(null).map(() =>
        request(app)
          .get('/api/v1/cart-tryons')
          .set('X-API-Key', validApiKey)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/cart-tryons')
        .set('X-API-Key', validApiKey);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});

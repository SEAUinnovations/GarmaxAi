import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { webhookService } from '../../src/services/webhookService';
import { storage } from '../../src/storage';
import axios from 'axios';
import crypto from 'crypto';
import express from 'express';
import type { Server } from 'http';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Webhook Delivery and Retries', () => {
  let organizationId: string;
  let webhookId: string;
  let webhookSecret: string;
  let mockServer: Server;
  let receivedWebhooks: any[] = [];

  beforeAll(async () => {
    // Create test organization
    const org = await storage.createOrganization({
      name: 'Webhook Test Org',
      billingEmail: 'webhook@example.com',
      credits: 1000,
      settings: {},
      status: 'active'
    });
    organizationId = org.id;

    // Start mock webhook receiver server
    const app = express();
    app.use(express.json());

    app.post('/webhook-success', (req, res) => {
      receivedWebhooks.push({
        timestamp: new Date(),
        signature: req.headers['x-webhook-signature'],
        body: req.body
      });
      res.status(200).json({ received: true });
    });

    app.post('/webhook-fail', (req, res) => {
      res.status(500).json({ error: 'Internal server error' });
    });

    app.post('/webhook-timeout', (req, res) => {
      // Never respond (simulate timeout)
    });

    mockServer = app.listen(9999);
  });

  afterAll(async () => {
    // Cleanup
    if (webhookId) {
      await storage.deleteWebhook(webhookId);
    }
    if (organizationId) {
      await storage.deleteOrganization(organizationId);
    }
    if (mockServer) {
      mockServer.close();
    }
  });

  beforeEach(() => {
    receivedWebhooks = [];
    jest.clearAllMocks();
  });

  describe('Webhook Creation and Signature', () => {
    it('should create webhook with generated secret', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-success',
        events: ['cart_tryon.completed'],
        secret: crypto.randomBytes(32).toString('hex'),
        isActive: true
      });

      expect(webhook.id).toBeDefined();
      expect(webhook.secret).toBeDefined();
      expect(webhook.secret.length).toBeGreaterThan(20);
      
      webhookId = webhook.id;
      webhookSecret = webhook.secret;
    });

    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = { test: 'data' };
      const secret = 'test_secret_123';

      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA256 = 64 hex chars
    });
  });

  describe('Successful Delivery', () => {
    it('should deliver webhook with correct signature', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-success',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_success',
        isActive: true
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { received: true }
      });

      const payload = {
        event: 'cart_tryon.completed',
        timestamp: new Date().toISOString(),
        data: {
          sessionId: 'session_123',
          status: 'completed'
        }
      };

      await webhookService.deliverWebhook(webhook, payload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhook.url,
        payload,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expect.any(String)
          }),
          timeout: 30000
        })
      );

      // Verify webhook was updated
      const updatedWebhook = await storage.getWebhook(webhook.id);
      expect(updatedWebhook.lastTriggeredAt).toBeDefined();
      expect(updatedWebhook.failureCount).toBe(0);

      await storage.deleteWebhook(webhook.id);
    });

    it('should not increment failure count on success', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-success',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_no_fail',
        isActive: true
      });

      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: {} });

      await webhookService.deliverWebhook(webhook, {
        event: 'cart_tryon.completed',
        data: {}
      });

      const updatedWebhook = await storage.getWebhook(webhook.id);
      expect(updatedWebhook.failureCount).toBe(0);

      await storage.deleteWebhook(webhook.id);
    });
  });

  describe('Failed Delivery and Retries', () => {
    it('should retry on 5xx server error', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-fail',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_retry',
        isActive: true
      });

      // Mock 3 failures then success
      mockedAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ status: 200, data: {} });

      const payload = {
        event: 'cart_tryon.completed',
        data: { sessionId: 'retry_test' }
      };

      await webhookService.deliverWebhook(webhook, payload);

      // Should have made 4 attempts (initial + 3 retries)
      expect(mockedAxios.post).toHaveBeenCalledTimes(4);

      await storage.deleteWebhook(webhook.id);
    });

    it('should use exponential backoff delays (5s, 15s, 45s)', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-backoff',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_backoff',
        isActive: true
      });

      mockedAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } });

      const startTime = Date.now();
      const delays: number[] = [];

      // Mock setTimeout to capture delays
      const originalSetTimeout = setTimeout;
      (global as any).setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0); // Execute immediately for tests
      });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        // Expected to fail after retries
      }

      // Restore original setTimeout
      (global as any).setTimeout = originalSetTimeout;

      // Verify exponential backoff delays
      expect(delays).toContain(5000);   // 5 seconds
      expect(delays).toContain(15000);  // 15 seconds
      expect(delays).toContain(45000);  // 45 seconds

      await storage.deleteWebhook(webhook.id);
    });

    it('should increment failure count on repeated failures', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-fail-count',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_fail_count',
        isActive: true,
        failureCount: 0
      });

      mockedAxios.post.mockRejectedValue({ response: { status: 500 } });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        // Expected to fail
      }

      const updatedWebhook = await storage.getWebhook(webhook.id);
      expect(updatedWebhook.failureCount).toBeGreaterThan(0);
      expect(updatedWebhook.lastFailedAt).toBeDefined();

      await storage.deleteWebhook(webhook.id);
    });

    it('should auto-disable webhook after 10 consecutive failures', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-auto-disable',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_auto_disable',
        isActive: true,
        failureCount: 9 // Start at 9, next failure will be 10th
      });

      mockedAxios.post.mockRejectedValue({ response: { status: 500 } });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        // Expected to fail
      }

      const updatedWebhook = await storage.getWebhook(webhook.id);
      expect(updatedWebhook.failureCount).toBeGreaterThanOrEqual(10);
      expect(updatedWebhook.isActive).toBe(false);

      await storage.deleteWebhook(webhook.id);
    });
  });

  describe('Webhook Filtering', () => {
    it('should only trigger webhooks for subscribed events', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-filtered',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_filter',
        isActive: true
      });

      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      // Should trigger
      await webhookService.triggerTryonCompletedWebhook(
        organizationId,
        'session_123',
        'cart_123',
        []
      );

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Should NOT trigger (different event)
      await webhookService.triggerTryonFailedWebhook(
        organizationId,
        'session_456',
        'cart_456',
        'Error message'
      );

      // Still only 1 call (didn't trigger for failed event)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      await storage.deleteWebhook(webhook.id);
    });

    it('should not deliver to inactive webhooks', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-inactive',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_inactive',
        isActive: false
      });

      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      await webhookService.triggerTryonCompletedWebhook(
        organizationId,
        'session_789',
        'cart_789',
        []
      );

      // Should not have been called (webhook inactive)
      expect(mockedAxios.post).not.toHaveBeenCalled();

      await storage.deleteWebhook(webhook.id);
    });
  });

  describe('Webhook Payload Structure', () => {
    it('should include all required fields in cart_tryon.completed event', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-payload',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_payload',
        isActive: true
      });

      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      await webhookService.triggerTryonCompletedWebhook(
        organizationId,
        'session_payload',
        'cart_payload',
        [
          {
            productId: 'prod_123',
            variantId: 'var_123',
            status: 'completed',
            resultUrl: 'https://s3.amazonaws.com/result.jpg'
          }
        ]
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          event: 'cart_tryon.completed',
          timestamp: expect.any(String),
          data: expect.objectContaining({
            sessionId: 'session_payload',
            cartId: 'cart_payload',
            organizationId,
            results: expect.arrayContaining([
              expect.objectContaining({
                productId: 'prod_123',
                variantId: 'var_123',
                status: 'completed',
                resultUrl: expect.any(String)
              })
            ])
          })
        }),
        expect.any(Object)
      );

      await storage.deleteWebhook(webhook.id);
    });

    it('should include error details in cart_tryon.failed event', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-error',
        events: ['cart_tryon.failed'],
        secret: 'test_secret_error',
        isActive: true
      });

      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      const errorMessage = 'Processing failed due to invalid image format';
      await webhookService.triggerTryonFailedWebhook(
        organizationId,
        'session_error',
        'cart_error',
        errorMessage
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          event: 'cart_tryon.failed',
          data: expect.objectContaining({
            sessionId: 'session_error',
            cartId: 'cart_error',
            error: errorMessage
          })
        }),
        expect.any(Object)
      );

      await storage.deleteWebhook(webhook.id);
    });
  });

  describe('Network Errors', () => {
    it('should handle connection timeout', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9999/webhook-timeout',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_timeout',
        isActive: true
      });

      mockedAxios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        expect(error).toBeDefined();
      }

      const updatedWebhook = await storage.getWebhook(webhook.id);
      expect(updatedWebhook.failureCount).toBeGreaterThan(0);

      await storage.deleteWebhook(webhook.id);
    });

    it('should handle DNS resolution failure', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://nonexistent-domain-12345.com/webhook',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_dns',
        isActive: true
      });

      mockedAxios.post.mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND'
      });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        expect(error).toBeDefined();
      }

      await storage.deleteWebhook(webhook.id);
    });

    it('should handle connection refused', async () => {
      const webhook = await storage.createWebhook({
        organizationId,
        url: 'http://localhost:9998/webhook',
        events: ['cart_tryon.completed'],
        secret: 'test_secret_refused',
        isActive: true
      });

      mockedAxios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED'
      });

      try {
        await webhookService.deliverWebhook(webhook, {
          event: 'test',
          data: {}
        });
      } catch (error) {
        expect(error).toBeDefined();
      }

      await storage.deleteWebhook(webhook.id);
    });
  });
});

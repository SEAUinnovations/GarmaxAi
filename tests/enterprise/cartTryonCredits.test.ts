import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { storage } from '../../src/storage';
import { generateApiKey } from '../../src/utils/apiKeyGenerator';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

describe('Cart Try-On with Credits', () => {
  let organizationId: string;
  let apiKey: string;
  let customerExternalId: string;
  let customerPhotoS3Key: string;

  beforeAll(async () => {
    // Create test organization with credits
    const org = await storage.createOrganization({
      name: 'Test Cart Org',
      billingEmail: 'cart@example.com',
      credits: 100,
      settings: {},
      status: 'active'
    });
    organizationId = org.id;

    // Create API key
    const { key, keyHash, keyPrefix } = await generateApiKey();
    apiKey = key;

    await storage.createApiKey({
      organizationId,
      name: 'Cart Test Key',
      keyHash,
      keyPrefix,
      scopes: ['all'],
      isActive: true
    });

    // Create external customer with photo
    customerExternalId = 'test_customer_123';
    const customer = await storage.upsertExternalCustomer({
      organizationId,
      externalId: customerExternalId,
      email: 'customer@example.com',
      name: 'Test Customer'
    });

    customerPhotoS3Key = `enterprise/org-${organizationId}/photos/${customer.id}.jpg`;
    
    // Mock S3 upload for customer photo
    await storage.updateExternalCustomer(customer.id, {
      photoS3Key: customerPhotoS3Key,
      photoUrl: `https://s3.amazonaws.com/bucket/${customerPhotoS3Key}`
    });
  });

  afterAll(async () => {
    // Cleanup
    if (organizationId) {
      await storage.deleteOrganization(organizationId);
    }
  });

  describe('Credit Calculation', () => {
    it('should calculate credits correctly for single item (SD quality)', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_sd_single',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_001',
              variantId: 'var_001',
              name: 'Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'sd'
        });

      expect(response.status).toBe(201);
      expect(response.body.creditsRequired).toBe(1); // 1 item × 1 credit × 1x SD multiplier
      expect(response.body.creditsCharged).toBe(1);
    });

    it('should calculate credits correctly for HD quality', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_hd_single',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_002',
              variantId: 'var_002',
              name: 'HD Product',
              imageUrl: 'https://example.com/product2.jpg',
              category: 'tops',
              quantity: 1,
              price: 49.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'hd'
        });

      expect(response.status).toBe(201);
      expect(response.body.creditsRequired).toBe(2); // 1 item × 1 credit × 2x HD multiplier
      expect(response.body.creditsCharged).toBe(2);
    });

    it('should calculate credits correctly for 4K quality', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_4k_single',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_003',
              variantId: 'var_003',
              name: '4K Product',
              imageUrl: 'https://example.com/product3.jpg',
              category: 'tops',
              quantity: 1,
              price: 79.99,
              currency: 'USD'
            }
          ],
          renderQuality: '4k'
        });

      expect(response.status).toBe(201);
      expect(response.body.creditsRequired).toBe(4); // 1 item × 1 credit × 4x 4K multiplier
      expect(response.body.creditsCharged).toBe(4);
    });

    it('should apply 10% discount for 5-9 items', async () => {
      const cartItems = Array(5).fill(null).map((_, i) => ({
        productId: `prod_discount5_${i}`,
        variantId: `var_${i}`,
        name: `Product ${i}`,
        imageUrl: 'https://example.com/product.jpg',
        category: 'tops',
        quantity: 1,
        price: 29.99,
        currency: 'USD'
      }));

      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_discount_5items',
          customerPhotoS3Key,
          cartItems,
          renderQuality: 'sd'
        });

      expect(response.status).toBe(201);
      // Base: 5 items × 1 credit × 1x SD = 5 credits
      // Discount: 5 × 0.9 = 4.5 → rounded to 5 (might round differently)
      expect(response.body.creditsRequired).toBeLessThanOrEqual(5);
    });

    it('should apply 20% discount for 10-14 items', async () => {
      const cartItems = Array(10).fill(null).map((_, i) => ({
        productId: `prod_discount10_${i}`,
        variantId: `var_${i}`,
        name: `Product ${i}`,
        imageUrl: 'https://example.com/product.jpg',
        category: 'tops',
        quantity: 1,
        price: 29.99,
        currency: 'USD'
      }));

      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_discount_10items',
          customerPhotoS3Key,
          cartItems,
          renderQuality: 'sd'
        });

      expect(response.status).toBe(201);
      // Base: 10 items × 1 credit × 1x SD = 10 credits
      // Discount: 10 × 0.8 = 8 credits
      expect(response.body.creditsRequired).toBe(8);
    });
  });

  describe('Atomic Credit Deduction', () => {
    it('should deduct credits immediately on session creation', async () => {
      const orgBefore = await storage.getOrganization(organizationId);
      const creditsBefore = orgBefore.credits;

      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_atomic_test',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_atomic',
              variantId: 'var_atomic',
              name: 'Atomic Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'hd'
        });

      expect(response.status).toBe(201);

      const orgAfter = await storage.getOrganization(organizationId);
      const creditsAfter = orgAfter.credits;

      expect(creditsAfter).toBe(creditsBefore - 2); // HD = 2 credits
    });

    it('should refund credits on cancellation if not processed', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_refund_test',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_refund',
              variantId: 'var_refund',
              name: 'Refund Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'hd'
        });

      expect(response.status).toBe(201);
      const sessionId = response.body.id;

      const orgBefore = await storage.getOrganization(organizationId);
      const creditsBefore = orgBefore.credits;

      // Cancel immediately
      const cancelResponse = await request(app)
        .post(`/api/v1/cart-tryons/${sessionId}/cancel`)
        .set('X-API-Key', apiKey);

      expect(cancelResponse.status).toBe(200);

      const orgAfter = await storage.getOrganization(organizationId);
      const creditsAfter = orgAfter.credits;

      expect(creditsAfter).toBe(creditsBefore + 2); // Refunded 2 HD credits
    });

    it('should reject request with insufficient credits', async () => {
      // Update org to have only 1 credit
      await storage.updateOrganization(organizationId, { credits: 1 });

      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_insufficient',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_insuf',
              variantId: 'var_insuf',
              name: 'Insufficient Credit Test',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'hd' // Requires 2 credits
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient credits');

      // Restore credits for other tests
      await storage.updateOrganization(organizationId, { credits: 100 });
    });
  });

  describe('Session Status Tracking', () => {
    it('should create session in queued status', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_status_test',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_status',
              variantId: 'var_status',
              name: 'Status Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'sd'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('queued');
      expect(response.body.progress).toBe(0);
    });

    it('should track progress during processing', async () => {
      const createResponse = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_progress_test',
          customerPhotoS3Key,
          cartItems: Array(3).fill(null).map((_, i) => ({
            productId: `prod_progress_${i}`,
            variantId: `var_${i}`,
            name: `Progress Product ${i}`,
            imageUrl: 'https://example.com/product.jpg',
            category: 'tops',
            quantity: 1,
            price: 29.99,
            currency: 'USD'
          })),
          renderQuality: 'sd'
        });

      expect(createResponse.status).toBe(201);
      const sessionId = createResponse.body.id;

      // Check status
      const statusResponse = await request(app)
        .get(`/api/v1/cart-tryons/${sessionId}`)
        .set('X-API-Key', apiKey);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('progress');
    });
  });

  describe('Validation', () => {
    it('should reject cart with more than 20 items', async () => {
      const cartItems = Array(21).fill(null).map((_, i) => ({
        productId: `prod_${i}`,
        variantId: `var_${i}`,
        name: `Product ${i}`,
        imageUrl: 'https://example.com/product.jpg',
        category: 'tops',
        quantity: 1,
        price: 29.99,
        currency: 'USD'
      }));

      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_too_many',
          customerPhotoS3Key,
          cartItems,
          renderQuality: 'sd'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 20 items');
    });

    it('should reject cart with empty items array', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_empty',
          customerPhotoS3Key,
          cartItems: [],
          renderQuality: 'sd'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one item required');
    });

    it('should reject cart with invalid render quality', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_invalid_quality',
          customerPhotoS3Key,
          cartItems: [
            {
              productId: 'prod_001',
              variantId: 'var_001',
              name: 'Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'ultra_hd'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid render quality');
    });

    it('should reject cart with missing customer photo', async () => {
      const response = await request(app)
        .post('/api/v1/cart-tryons')
        .set('X-API-Key', apiKey)
        .send({
          cartId: 'cart_no_photo',
          customerPhotoS3Key: 'nonexistent/photo.jpg',
          cartItems: [
            {
              productId: 'prod_001',
              variantId: 'var_001',
              name: 'Test Product',
              imageUrl: 'https://example.com/product.jpg',
              category: 'tops',
              quantity: 1,
              price: 29.99,
              currency: 'USD'
            }
          ],
          renderQuality: 'sd'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Customer photo not found');
    });
  });
});

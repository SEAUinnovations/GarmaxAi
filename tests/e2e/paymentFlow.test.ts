/**
 * E2E Test: Payment and Subscription Flow
 * 
 * Tests the complete payment workflow:
 * 1. Create Stripe checkout session
 * 2. Simulate successful payment webhook
 * 3. Verify subscription synced to database
 * 4. Verify quota increase applied
 * 5. Test quota enforcement
 * 
 * Prerequisites:
 * - Docker services running (docker-compose up)
 * - Test user account created
 * - Stripe test API keys configured
 * - Subscription plans seeded in database
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Stripe from 'stripe';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Test user credentials
const TEST_USER = {
  email: 'test-payment@example.com',
  password: 'TestPassword123!',
};

let authToken: string;
let userId: string;
let stripe: Stripe;
let testSubscriptionId: string;

describe('Payment Flow E2E', () => {
  
  beforeAll(async () => {
    // Initialize Stripe client
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Authenticate and get JWT token
    const authResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    expect(authResponse.ok).toBe(true);
    const authData = await authResponse.json();
    authToken = authData.token;
    userId = authData.user.id;
    
    console.log('✅ Authenticated successfully');
  });

  it('should get initial subscription info (free tier)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    // User should be on free tier initially
    expect(data.isActive).toBe(false);
    expect(data.avatarLimit).toBe(1);
    expect(data.tryonQuota).toBe(10);
    
    console.log('✅ Initial state: Free tier confirmed');
  });

  it('should create Stripe checkout session', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/create-checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_test_starter',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.url).toBeTruthy();
    expect(data.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    
    console.log(`✅ Checkout session created: ${data.url}`);
  });

  it('should process Stripe webhook for successful payment', async () => {
    // Create a test subscription directly (simulating successful checkout)
    const customer = await stripe.customers.create({
      email: TEST_USER.email,
      metadata: { userId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: process.env.STRIPE_STARTER_PRICE_ID || 'price_test_starter' }],
      metadata: { userId },
    });

    testSubscriptionId = subscription.id;

    // Simulate webhook event
    const webhookEvent = {
      type: 'customer.subscription.created',
      data: {
        object: subscription,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature', // In real test, compute HMAC
      },
      body: JSON.stringify(webhookEvent),
    });

    // Webhook handler should return 200 even if signature fails
    // In production, use Stripe CLI to forward real webhooks
    console.log(`📨 Webhook response: ${response.status}`);
  });

  it('should verify subscription synced to database', async () => {
    // Wait for webhook processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    // User should now be on Starter plan
    expect(data.isActive).toBe(true);
    expect(data.plan?.name).toBe('Starter');
    expect(data.avatarLimit).toBe(3);
    expect(data.tryonQuota).toBe(100);
    expect(data.subscription?.stripeSubscriptionId).toBe(testSubscriptionId);
    
    console.log('✅ Subscription synced successfully');
    console.log(`   - Plan: ${data.plan.name}`);
    console.log(`   - Avatars: ${data.avatarLimit}`);
    console.log(`   - Try-ons: ${data.tryonQuota}/month`);
  });

  it('should enforce avatar creation limit', async () => {
    // Get current avatar count
    const infoResponse = await fetch(`${API_BASE_URL}/api/subscriptions/avatar-limit`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const limitInfo = await infoResponse.json();
    console.log(`📊 Avatar limit: ${limitInfo.currentCount}/${limitInfo.limit}`);
    
    expect(limitInfo.limit).toBe(3); // Starter plan
    expect(limitInfo.canCreate).toBe(limitInfo.currentCount < 3);
  });

  it('should enforce try-on quota', async () => {
    const infoResponse = await fetch(`${API_BASE_URL}/api/subscriptions/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await infoResponse.json();
    
    expect(data.tryonQuota).toBe(100); // Starter plan
    expect(data.tryonQuotaUsed).toBeGreaterThanOrEqual(0);
    expect(data.tryonQuotaUsed).toBeLessThanOrEqual(100);
    
    const remaining = data.tryonQuota - data.tryonQuotaUsed;
    console.log(`📊 Try-on quota: ${data.tryonQuotaUsed}/${data.tryonQuota} (${remaining} remaining)`);
  });

  it('should handle subscription cancellation', async () => {
    // Cancel subscription in Stripe
    const canceledSubscription = await stripe.subscriptions.cancel(testSubscriptionId);

    // Simulate webhook event
    const webhookEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: canceledSubscription,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature',
      },
      body: JSON.stringify(webhookEvent),
    });

    console.log(`📨 Cancellation webhook response: ${response.status}`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify subscription marked as cancelled
    const infoResponse = await fetch(`${API_BASE_URL}/api/subscriptions/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await infoResponse.json();
    
    // Subscription should be cancelled or inactive
    if (data.subscription) {
      expect(data.subscription.status).toMatch(/cancelled|canceled/);
    }
    
    console.log('✅ Subscription cancelled successfully');
  });

  afterAll(async () => {
    // Cleanup: Delete test subscription if still exists
    try {
      if (testSubscriptionId) {
        await stripe.subscriptions.cancel(testSubscriptionId);
        console.log(`🗑️  Cleaned up test subscription: ${testSubscriptionId}`);
      }
    } catch (error) {
      // Already cancelled or doesn't exist
    }
  });
});

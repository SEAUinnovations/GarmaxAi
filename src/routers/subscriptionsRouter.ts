import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { subscriptionService } from '../services/subscriptionService';
import * as subscriptionDB from '../services/subscriptionDatabase';
import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import Stripe from 'stripe';

// Extend Request type for authenticated routes
interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5001';

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    // Query plans directly from database using Drizzle
    const { subscriptionPlans } = await import('@shared/schema');
    const storageInstance = await storage.getUserById('dummy');
    const plans = await (storageInstance as any).db
      .select()
      .from(subscriptionPlans);
    
    res.json({
      plans: plans.map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        price: plan.price / 100,
        avatarLimit: plan.avatarLimit,
        tryonQuota: plan.tryonQuota,
        maxResolution: plan.maxResolution,
        features: plan.features,
      })),
    });
  } catch (error: any) {
    logger.error(`Failed to fetch subscription plans: ${error.message}`, 'subscriptionsRouter');
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * GET /api/subscriptions/current
 * Get current user's active subscription
 */
router.get('/current', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscriptionInfo = await subscriptionService.getSubscriptionInfo(userId);
    
    res.json({
      subscription: subscriptionInfo.subscription,
      plan: subscriptionInfo.plan,
      avatarLimit: subscriptionInfo.avatarLimit,
      tryonQuota: subscriptionInfo.tryonQuota,
      tryonQuotaUsed: subscriptionInfo.tryonQuotaUsed,
      isActive: subscriptionInfo.isActive,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch subscription: ${error.message}`, 'subscriptionsRouter');
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscriptions/create-checkout
 * Create a Stripe checkout session for subscription
 */
router.post('/create-checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planId, billingCycle } = req.body;

    if (!planId || !['monthly', 'annual'].includes(billingCycle)) {
      res.status(400).json({ error: 'Invalid plan or billing cycle' });
      return;
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { subscriptionPlans } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const storageInstance = await storage.getUserById('dummy');
    const [plan] = await (storageInstance as any).db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    
    if (!plan || !plan.stripePriceId) {
      res.status(404).json({ error: 'Plan not found or not available for purchase' });
      return;
    }

    let priceId = plan.stripePriceId;
    if (billingCycle === 'annual') {
      const annualPriceId = process.env[`STRIPE_${planId.toUpperCase()}_ANNUAL_PRICE_ID`];
      if (annualPriceId) {
        priceId = annualPriceId;
      } else {
        logger.warn(`No annual price ID found for plan ${planId}, using monthly`, 'subscriptionsRouter');
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/pricing?canceled=true`,
      metadata: { userId, planId, billingCycle },
    });

    logger.info(`Created checkout session ${session.id} for user ${userId}, plan ${planId}`, 'subscriptionsRouter');
    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    logger.error(`Failed to create checkout session: ${error.message}`, 'subscriptionsRouter');
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/subscriptions/portal
 * Create a Stripe billing portal session
 */
router.post('/portal', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscription = await subscriptionDB.getActiveSubscription(userId);
    
    if (!subscription?.subscription.stripeCustomerId) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.subscription.stripeCustomerId,
      return_url: `${FRONTEND_URL}/account`,
    });

    logger.info(`Created billing portal session for user ${userId}`, 'subscriptionsRouter');
    res.json({ url: portalSession.url });
  } catch (error: any) {
    logger.error(`Failed to create portal session: ${error.message}`, 'subscriptionsRouter');
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel user's subscription
 */
router.post('/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscriptionData = await subscriptionDB.getActiveSubscription(userId);
    
    if (!subscriptionData?.subscription.stripeSubscriptionId) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    await stripe.subscriptions.update(subscriptionData.subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    logger.info(`Scheduled cancellation for subscription ${subscriptionData.subscription.stripeSubscriptionId}, user ${userId}`, 'subscriptionsRouter');
    res.json({
      message: 'Subscription will be cancelled at the end of the billing period',
      periodEnd: subscriptionData.subscription.currentPeriodEnd,
    });
  } catch (error: any) {
    logger.error(`Failed to cancel subscription: ${error.message}`, 'subscriptionsRouter');
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;

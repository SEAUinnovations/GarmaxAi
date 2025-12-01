import Stripe from "stripe";
import { storage } from "../storage";
import { logger } from "../utils/winston-logger";
import type { Subscription, SubscriptionPlan } from "@shared/schema";
import * as subscriptionDB from "./subscriptionDatabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export interface AvatarLimitInfo {
  currentCount: number;
  limit: number;
  canCreate: boolean;
}

export interface SubscriptionInfo {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  avatarLimit: number;
  tryonQuota: number;
  tryonQuotaUsed: number;
  isActive: boolean;
}

/**
 * Subscription Service
 * Handles Stripe integration, avatar limits, and quota management
 */
export class SubscriptionService {
  /**
   * Get avatar limit for user based on subscription
   */
  async getAvatarLimit(userId: string): Promise<number> {
    try {
      const activeSubscription = await subscriptionDB.getActiveSubscription(userId);
      
      if (activeSubscription) {
        logger.info(`Avatar limit for user ${userId}: ${activeSubscription.plan.avatarLimit}`, "SubscriptionService");
        return activeSubscription.plan.avatarLimit;
      }
      
      // No active subscription - return free tier limit
      logger.info(`No active subscription for user ${userId} - using free tier`, "SubscriptionService");
      return 1; // Free tier: 1 avatar
    } catch (error) {
      logger.error(`Failed to get avatar limit: ${error}`, "SubscriptionService");
      return 1;
    }
  }

  /**
   * Check if user can create a new avatar
   */
  async canCreateAvatar(userId: string): Promise<AvatarLimitInfo> {
    try {
      const currentCount = await subscriptionDB.getUserAvatarCount(userId);
      const limit = await this.getAvatarLimit(userId);
      
      return {
        currentCount,
        limit,
        canCreate: currentCount < limit,
      };
    } catch (error) {
      logger.error(`Failed to check avatar creation: ${error}`, "SubscriptionService");
      return { currentCount: 0, limit: 1, canCreate: false };
    }
  }

  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
    try {
      const activeSubscription = await subscriptionDB.getActiveSubscription(userId);
      
      if (activeSubscription) {
        return {
          subscription: activeSubscription.subscription,
          plan: activeSubscription.plan,
          avatarLimit: activeSubscription.plan.avatarLimit,
          tryonQuota: activeSubscription.plan.tryonQuota,
          tryonQuotaUsed: activeSubscription.subscription.tryonQuotaUsed,
          isActive: true,
        };
      }
      
      // No active subscription - return free tier
      logger.info(`No active subscription for user ${userId} - using free tier`, "SubscriptionService");
      return {
        subscription: null,
        plan: null,
        avatarLimit: 1,
        tryonQuota: 10, // Free tier gets 10 try-ons per month
        tryonQuotaUsed: 0,
        isActive: false,
      };
    } catch (error) {
      logger.error(`Failed to get subscription info: ${error}`, "SubscriptionService");
      throw error;
    }
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check for existing Stripe customer
      let customerId = await subscriptionDB.getOrCreateStripeCustomer(userId);
      
      if (!customerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        logger.info(`Created Stripe customer ${customerId} for user ${userId}`, "SubscriptionService");
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId },
      });

      logger.info(`Checkout session created for user ${userId}`, "SubscriptionService");
      return session.url || "";
    } catch (error) {
      logger.error(`Failed to create checkout session: ${error}`, "SubscriptionService");
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.syncSubscription(subscription);
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.cancelSubscription(subscription.id);
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as any; // Use any to access Stripe webhook properties
          if (invoice.subscription) {
            await this.handlePaymentFailure(invoice.subscription as string);
          }
          break;
        }
      }
      
      logger.info(`Webhook event processed: ${event.type}`, "SubscriptionService");
    } catch (error) {
      logger.error(`Webhook handling failed: ${error}`, "SubscriptionService");
      throw error;
    }
  }

  /**
   * Sync Stripe subscription to database
   */
  private async syncSubscription(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) {
      throw new Error("No userId in subscription metadata");
    }

    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      throw new Error("No price ID in subscription");
    }

    // Get plan from database
    const plan = await subscriptionDB.getPlanByStripePriceId(priceId);
    if (!plan) {
      logger.error(`Plan not found for Stripe price ${priceId}`, "SubscriptionService");
      throw new Error(`Plan not found for Stripe price ${priceId}`);
    }

    // Upsert subscription
    await subscriptionDB.upsertSubscription({
      userId,
      planId: plan.id,
      status: stripeSubscription.status,
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      stripeCustomerId: stripeSubscription.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
    });

    logger.info(`Subscription synced for user ${userId}: ${stripeSubscription.id}`, "SubscriptionService");
  }

  /**
   * Cancel subscription
   */
  private async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await subscriptionDB.cancelSubscription(stripeSubscriptionId);
    logger.info(`Subscription cancelled: ${stripeSubscriptionId}`, "SubscriptionService");
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(stripeSubscriptionId: string): Promise<void> {
    await subscriptionDB.markSubscriptionPastDue(stripeSubscriptionId);
    logger.warn(`Payment failed for subscription: ${stripeSubscriptionId}`, "SubscriptionService");
  }

  /**
   * Reset monthly quotas (called by scheduled job)
   */
  async resetMonthlyQuotas(): Promise<void> {
    try {
      const resetCount = await subscriptionDB.resetAllMonthlyQuotas();
      logger.info(`Monthly quotas reset for ${resetCount} active subscriptions`, "SubscriptionService");
    } catch (error) {
      logger.error(`Failed to reset monthly quotas: ${error}`, "SubscriptionService");
      throw error;
    }
  }

  /**
   * Check if user has try-on quota available
   */
  async hasTryonQuota(userId: string): Promise<boolean> {
    try {
      const info = await this.getSubscriptionInfo(userId);
      
      // Free tier users always have quota (no subscription needed)
      if (!info.isActive) {
        return info.tryonQuotaUsed < info.tryonQuota;
      }

      // Paid users check their subscription quota
      return info.tryonQuotaUsed < info.tryonQuota;
    } catch (error) {
      logger.error(`Failed to check try-on quota: ${error}`, "SubscriptionService");
      return false;
    }
  }

  /**
   * Increment try-on quota usage
   */
  async incrementTryonQuota(userId: string): Promise<void> {
    try {
      await subscriptionDB.incrementTryonQuota(userId);
      logger.info(`Try-on quota incremented for user ${userId}`, "SubscriptionService");
    } catch (error) {
      logger.error(`Failed to increment quota: ${error}`, "SubscriptionService");
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();

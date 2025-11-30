import Stripe from "stripe";
import { storage } from "../storage";
import { logger } from "../utils/winston-logger";
import type { Subscription, SubscriptionPlan } from "@shared/schema";

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
      const subscription = await storage.getActiveSubscription?.(userId);
      
      if (!subscription) {
        return 1; // Free tier: 1 avatar
      }

      const plan = await storage.getSubscriptionPlan?.(subscription.planId);
      return plan?.avatarLimit || 1;
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
      const currentCount = await storage.getUserAvatarCount?.(userId) || 0;
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
      const subscription = await storage.getActiveSubscription?.(userId);
      
      if (!subscription) {
        return {
          subscription: null,
          plan: null,
          avatarLimit: 1,
          tryonQuota: 0,
          tryonQuotaUsed: 0,
          isActive: false,
        };
      }

      const plan = await storage.getSubscriptionPlan?.(subscription.planId);
      
      return {
        subscription,
        plan: plan || null,
        avatarLimit: plan?.avatarLimit || 1,
        tryonQuota: plan?.tryonQuota || 0,
        tryonQuotaUsed: subscription.tryonQuotaUsed,
        isActive: subscription.status === "active",
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

      // Get or create Stripe customer
      let customerId = await storage.getStripeCustomerId?.(userId);
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId?.(userId, customerId);
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
          const invoice = event.data.object as Stripe.Invoice;
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
    const plan = await storage.getSubscriptionPlanByStripePrice?.(priceId);
    
    if (!plan) {
      throw new Error(`No plan found for Stripe price ${priceId}`);
    }

    await storage.upsertSubscription?.({
      userId,
      planId: plan.id,
      status: stripeSubscription.status,
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      stripeCustomerId: stripeSubscription.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
    });
  }

  /**
   * Cancel subscription
   */
  private async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await storage.cancelSubscriptionByStripeId?.(stripeSubscriptionId);
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(stripeSubscriptionId: string): Promise<void> {
    await storage.updateSubscriptionStatus?.(stripeSubscriptionId, "past_due");
  }

  /**
   * Reset monthly quotas (called by scheduled job)
   */
  async resetMonthlyQuotas(): Promise<void> {
    try {
      await storage.resetAllSubscriptionQuotas?.();
      logger.info("Monthly quotas reset successfully", "SubscriptionService");
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
      
      if (!info.isActive) {
        return false;
      }

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
      await storage.incrementSubscriptionQuota?.(userId);
      logger.info(`Try-on quota incremented for user ${userId}`, "SubscriptionService");
    } catch (error) {
      logger.error(`Failed to increment quota: ${error}`, "SubscriptionService");
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();

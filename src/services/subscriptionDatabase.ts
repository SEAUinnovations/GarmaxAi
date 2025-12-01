/**
 * Subscription database helper
 * Handles database operations for subscriptions and plans
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { subscriptions, subscriptionPlans, users, userAvatars } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/winston-logger';
import type { Subscription, SubscriptionPlan } from '@shared/schema';

// Database connection - lazily initialized
let db: ReturnType<typeof drizzle> | null = null;

function getDb(): ReturnType<typeof drizzle> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL || 
      `mysql://${process.env.DB_USER || 'garmaxai'}:${process.env.DB_PASSWORD || 'garmaxai_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}/${process.env.DB_NAME || 'garmaxai'}`;
    const connection = mysql.createPool(connectionString);
    db = drizzle(connection);
  }
  return db;
}

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: SubscriptionPlan;
}

/**
 * Get active subscription for user
 */
export async function getActiveSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  try {
    const result = await db
      .select({
        subscription: subscriptions,
        plan: subscriptionPlans
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return {
      subscription: result[0].subscription,
      plan: result[0].plan
    };
  } catch (error) {
    logger.error(`Error getting active subscription for user ${userId}: ${error}`, 'SubscriptionDB');
    return null;
  }
}

/**
 * Create or update subscription
 */
export async function upsertSubscription(data: {
  userId: string;
  planId: string;
  status: string;
  currentPeriodEnd: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<Subscription> {
  try {
    // Check if subscription exists
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId))
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      await db
        .update(subscriptions)
        .set({
          status: data.status,
          currentPeriodEnd: data.currentPeriodEnd,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId));

      const updated = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId))
        .limit(1);

      logger.info(`Subscription updated: ${data.stripeSubscriptionId}`, 'SubscriptionDB');
      return updated[0] as Subscription;
    } else {
      // Create new
      const id = crypto.randomUUID();
      await db.insert(subscriptions).values({
        id,
        userId: data.userId,
        planId: data.planId,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd,
        tryonQuotaUsed: 0,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId
      });

      const created = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .limit(1);

      logger.info(`Subscription created: ${data.stripeSubscriptionId}`, 'SubscriptionDB');
      return created[0] as Subscription;
    }
  } catch (error) {
    logger.error(`Error upserting subscription: ${error}`, 'SubscriptionDB');
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(stripeSubscriptionId: string): Promise<void> {
  try {
    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    logger.info(`Subscription cancelled: ${stripeSubscriptionId}`, 'SubscriptionDB');
  } catch (error) {
    logger.error(`Error cancelling subscription: ${error}`, 'SubscriptionDB');
    throw error;
  }
}

/**
 * Mark subscription as past_due
 */
export async function markSubscriptionPastDue(stripeSubscriptionId: string): Promise<void> {
  try {
    await db
      .update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    logger.warn(`Subscription marked past_due: ${stripeSubscriptionId}`, 'SubscriptionDB');
  } catch (error) {
    logger.error(`Error marking subscription past_due: ${error}`, 'SubscriptionDB');
    throw error;
  }
}

/**
 * Get user avatar count
 */
export async function getUserAvatarCount(userId: string): Promise<number> {
  try {
    const result = await db
      .select()
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId));

    return result.length;
  } catch (error) {
    logger.error(`Error getting avatar count for user ${userId}: ${error}`, 'SubscriptionDB');
    return 0;
  }
}

/**
 * Increment try-on quota usage
 */
export async function incrementTryonQuota(userId: string): Promise<void> {
  try {
    // Get active subscription
    const activeSubscription = await getActiveSubscription(userId);
    if (!activeSubscription) {
      logger.warn(`No active subscription for user ${userId} - cannot increment quota`, 'SubscriptionDB');
      return;
    }

    await db
      .update(subscriptions)
      .set({
        tryonQuotaUsed: activeSubscription.subscription.tryonQuotaUsed + 1,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, activeSubscription.subscription.id));

    logger.info(`Try-on quota incremented for user ${userId}`, 'SubscriptionDB');
  } catch (error) {
    logger.error(`Error incrementing try-on quota: ${error}`, 'SubscriptionDB');
    throw error;
  }
}

/**
 * Reset all monthly quotas (called on first day of month)
 */
export async function resetAllMonthlyQuotas(): Promise<number> {
  try {
    const result = await db
      .update(subscriptions)
      .set({
        tryonQuotaUsed: 0,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.status, 'active'));

    const resetCount = result[0]?.affectedRows || 0;
    logger.info(`Reset monthly quotas for ${resetCount} active subscriptions`, 'SubscriptionDB');
    return resetCount;
  } catch (error) {
    logger.error(`Error resetting monthly quotas: ${error}`, 'SubscriptionDB');
    throw error;
  }
}

/**
 * Get subscription plan by Stripe price ID
 */
export async function getPlanByStripePriceId(stripePriceId: string): Promise<SubscriptionPlan | null> {
  try {
    const result = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.stripePriceId, stripePriceId))
      .limit(1);

    return result && result.length > 0 ? (result[0] as SubscriptionPlan) : null;
  } catch (error) {
    logger.error(`Error getting plan by Stripe price ID ${stripePriceId}: ${error}`, 'SubscriptionDB');
    return null;
  }
}

/**
 * Get or create Stripe customer ID for user
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string | null> {
  try {
    // Check if user has existing subscription with customer ID
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (result && result.length > 0 && result[0].stripeCustomerId) {
      return result[0].stripeCustomerId;
    }

    return null; // Will be created in Stripe
  } catch (error) {
    logger.error(`Error getting Stripe customer for user ${userId}: ${error}`, 'SubscriptionDB');
    return null;
  }
}

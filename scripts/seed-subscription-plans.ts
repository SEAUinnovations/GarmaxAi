/**
 * Database Migration: Seed Subscription Plans
 * 
 * Populates subscriptionPlans table with 3 tiers:
 * - Free: 1 avatar, 10 try-ons/month (no Stripe price needed)
 * - Starter: $9.99/month, 3 avatars, 100 try-ons/month
 * - Pro: $29.99/month, 10 avatars, 500 try-ons/month
 * - Premium: $99.99/month, unlimited avatars, unlimited try-ons
 * 
 * Usage:
 *   npm run migrate:seed-plans
 * 
 * Environment Variables Required:
 *   - DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   - STRIPE_STARTER_PRICE_ID (from Stripe dashboard)
 *   - STRIPE_PRO_PRICE_ID (from Stripe dashboard)
 *   - STRIPE_PREMIUM_PRICE_ID (from Stripe dashboard)
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { subscriptionPlans } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER || 'garmaxai';
const DB_PASSWORD = process.env.DB_PASSWORD || 'garmaxai_password';
const DB_NAME = process.env.DB_NAME || 'garmaxai';

// Stripe price IDs (must be created in Stripe dashboard first)
const STRIPE_STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID || '';
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || '';

interface SubscriptionPlanSeed {
  id: string;
  name: string;
  priceUsd: number;
  avatarLimit: number;
  tryonQuota: number;
  stripePriceId: string | null;
  features: string[];
}

const SUBSCRIPTION_PLANS: SubscriptionPlanSeed[] = [
  {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    avatarLimit: 1,
    tryonQuota: 10,
    stripePriceId: null, // Free tier doesn't require Stripe
    features: [
      '1 custom avatar',
      '10 try-ons per month',
      'Standard quality renders',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 9.99,
    avatarLimit: 3,
    tryonQuota: 100,
    stripePriceId: STRIPE_STARTER_PRICE_ID,
    features: [
      '3 custom avatars',
      '100 try-ons per month',
      'High quality renders',
      'Priority processing',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 29.99,
    avatarLimit: 10,
    tryonQuota: 500,
    stripePriceId: STRIPE_PRO_PRICE_ID,
    features: [
      '10 custom avatars',
      '500 try-ons per month',
      'Ultra quality renders',
      'Highest priority processing',
      'Advanced customization',
      'Priority email support',
      'API access',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceUsd: 99.99,
    avatarLimit: 9999, // "Unlimited" = very high limit
    tryonQuota: 9999,
    stripePriceId: STRIPE_PREMIUM_PRICE_ID,
    features: [
      'Unlimited avatars',
      'Unlimited try-ons',
      'Ultra quality renders',
      'Instant processing',
      'White-label options',
      'Dedicated support',
      'Full API access',
      'Custom integrations',
    ],
  },
];

async function seedSubscriptionPlans() {
  console.log('🌱 Starting subscription plans migration...\n');

  // Validate Stripe price IDs
  const missingPriceIds: string[] = [];
  if (!STRIPE_STARTER_PRICE_ID) missingPriceIds.push('STRIPE_STARTER_PRICE_ID');
  if (!STRIPE_PRO_PRICE_ID) missingPriceIds.push('STRIPE_PRO_PRICE_ID');
  if (!STRIPE_PREMIUM_PRICE_ID) missingPriceIds.push('STRIPE_PREMIUM_PRICE_ID');

  if (missingPriceIds.length > 0) {
    console.error('❌ ERROR: Missing Stripe price IDs:');
    missingPriceIds.forEach(id => console.error(`   - ${id}`));
    console.error('\n📝 Create these prices in Stripe dashboard first:');
    console.error('   1. Go to https://dashboard.stripe.com/products');
    console.error('   2. Create products with recurring monthly pricing');
    console.error('   3. Copy the price IDs (price_xxxxx) to .env file\n');
    process.exit(1);
  }

  // Connect to database
  let connection: mysql.Connection | null = null;
  try {
    if (DATABASE_URL) {
      connection = await mysql.createConnection(DATABASE_URL);
    } else {
      connection = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
      });
    }

    const db = drizzle(connection);

    console.log('✅ Database connection established\n');

    // Insert or update each plan
    for (const plan of SUBSCRIPTION_PLANS) {
      console.log(`📦 Processing plan: ${plan.name} ($${plan.priceUsd}/month)`);
      
      try {
        // Check if plan already exists
        const existing = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, plan.id))
          .limit(1);

        if (existing.length > 0) {
          // Update existing plan
          await db
            .update(subscriptionPlans)
            .set({
              name: plan.name,
              priceUsd: plan.priceUsd,
              avatarLimit: plan.avatarLimit,
              tryonQuota: plan.tryonQuota,
              stripePriceId: plan.stripePriceId,
              features: JSON.stringify(plan.features),
            })
            .where(eq(subscriptionPlans.id, plan.id));
          
          console.log(`   ✓ Updated existing plan: ${plan.id}`);
        } else {
          // Insert new plan
          await db.insert(subscriptionPlans).values({
            id: plan.id,
            name: plan.name,
            priceUsd: plan.priceUsd,
            avatarLimit: plan.avatarLimit,
            tryonQuota: plan.tryonQuota,
            stripePriceId: plan.stripePriceId,
            features: JSON.stringify(plan.features),
          });
          
          console.log(`   ✓ Inserted new plan: ${plan.id}`);
        }

        // Display plan details
        console.log(`      - Avatars: ${plan.avatarLimit}`);
        console.log(`      - Try-ons: ${plan.tryonQuota}/month`);
        console.log(`      - Stripe Price ID: ${plan.stripePriceId || 'N/A (Free tier)'}`);
        console.log(`      - Features: ${plan.features.length} items\n`);
      } catch (error) {
        console.error(`   ❌ Failed to process plan ${plan.id}:`, error);
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Total plans: ${SUBSCRIPTION_PLANS.length}`);
    console.log(`   - Free tier: ${SUBSCRIPTION_PLANS[0].name}`);
    console.log(`   - Paid tiers: ${SUBSCRIPTION_PLANS.slice(1).map(p => p.name).join(', ')}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run migration
seedSubscriptionPlans().catch(console.error);

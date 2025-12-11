/**
 * Database Migration: Seed Subscription Plans
 * 
 * Populates subscriptionPlans table with optimized pricing tiers:
 * - Free: 1 avatar, 5 try-ons/month (no Stripe price needed)
 * - Studio: $49/month ($41/year), 5 avatars, 100 try-ons/month
 * - Pro: $149/month ($124/year), unlimited avatars, unlimited try-ons
 * 
 * Usage:
 *   npm run migrate:seed-plans
 * 
 * Environment Variables Required:
 *   - DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   - STRIPE_STUDIO_PRICE_ID (from Stripe dashboard)
 *   - STRIPE_STUDIO_ANNUAL_PRICE_ID (from Stripe dashboard)
 *   - STRIPE_PRO_PRICE_ID (from Stripe dashboard)
 *   - STRIPE_PRO_ANNUAL_PRICE_ID (from Stripe dashboard)
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { subscriptionPlans } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER || 'garmaxai';
const DB_PASSWORD = process.env.DB_PASSWORD || 'garmaxai_password';
const DB_NAME = process.env.DB_NAME || 'garmaxai';

// Stripe price IDs (must be created in Stripe dashboard first)
const STRIPE_STUDIO_PRICE_ID = process.env.STRIPE_STUDIO_PRICE_ID || '';
const STRIPE_STUDIO_ANNUAL_PRICE_ID = process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID || '';
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const STRIPE_PRO_ANNUAL_PRICE_ID = process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '';

interface SubscriptionPlanSeed {
  id: string;
  name: string;
  priceUsd: number;
  avatarLimit: number;
  tryonQuota: number;
  maxResolution: string;
  stripePriceId: string | null;
  features: string[];
}

const SUBSCRIPTION_PLANS: SubscriptionPlanSeed[] = [
  {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    avatarLimit: 1,
    tryonQuota: 5,
    maxResolution: 'sd',
    stripePriceId: null, // Free tier doesn't require Stripe
    features: [
      '1 custom avatar',
      '5 try-ons per month',
      'Standard quality renders',
      'Demo photos available',
      'Community support',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    priceUsd: 49,
    avatarLimit: 5,
    tryonQuota: 100,
    maxResolution: 'hd',
    stripePriceId: STRIPE_STUDIO_PRICE_ID,
    features: [
      '5 custom avatars',
      '100 try-ons per month',
      'All quality levels (SD/HD/4K)',
      'Priority processing',
      'Save to wardrobe',
      'Email support',
      '25% discount on credits',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 149,
    avatarLimit: 9999, // Unlimited
    tryonQuota: 9999,
    maxResolution: '4k',
    stripePriceId: STRIPE_PRO_PRICE_ID,
    features: [
      'Unlimited avatars',
      'Unlimited try-ons',
      'All quality levels (SD/HD/4K)',
      'Instant processing (no queue)',
      'Advanced wardrobe management',
      'API access',
      'Priority support & training',
      '50% discount on credits',
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
              price: Math.round(plan.priceUsd * 100), // Convert dollars to cents
              avatarLimit: plan.avatarLimit,
              tryonQuota: plan.tryonQuota,
              maxResolution: plan.maxResolution,
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
            price: Math.round(plan.priceUsd * 100), // Convert dollars to cents
            avatarLimit: plan.avatarLimit,
            tryonQuota: plan.tryonQuota,
            maxResolution: plan.maxResolution,
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

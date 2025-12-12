#!/usr/bin/env node
/**
 * Script to ensure test user (bettstahlik@gmail.com) has sufficient credits for testing
 * 
 * Usage:
 *   npx tsx scripts/ensure-test-user-credits.ts
 * 
 * With custom amount:
 *   TARGET_CREDITS=50000 npx tsx scripts/ensure-test-user-credits.ts
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const TEST_USER_EMAIL = 'bettstahlik@gmail.com';
const TARGET_CREDITS = parseInt(process.env.TARGET_CREDITS || '100000');

async function ensureTestUserCredits() {
  console.log('====================================');
  console.log('TEST USER CREDIT MANAGER');
  console.log('====================================\n');

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log(`Connecting to database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  const connection = await mysql.createConnection(dbConfig);
  const db = drizzle(connection);

  try {
    // Find the test user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, TEST_USER_EMAIL))
      .limit(1);

    if (!user) {
      console.error(`\n❌ User ${TEST_USER_EMAIL} not found in database`);
      console.error('Please create the user first by logging in through the application.');
      process.exit(1);
    }

    console.log(`\nFound user: ${user.username} (${user.email})`);
    console.log(`Current credits: ${user.credits}`);
    console.log(`Current creditsRemaining: ${user.creditsRemaining}`);

    if (user.credits >= TARGET_CREDITS) {
      console.log(`\n✅ User already has ${user.credits} credits (target: ${TARGET_CREDITS})`);
      console.log('No update needed.');
    } else {
      console.log(`\nUpdating credits to ${TARGET_CREDITS}...`);

      await db
        .update(users)
        .set({
          credits: TARGET_CREDITS,
          creditsRemaining: TARGET_CREDITS,
        })
        .where(eq(users.email, TEST_USER_EMAIL));

      console.log(`\n✅ Successfully updated ${TEST_USER_EMAIL} credits to ${TARGET_CREDITS}`);
      console.log('\nTest user is ready for end-to-end testing:');
      console.log('  • Create model workflow');
      console.log('  • Generate renders (SD: 10 credits, HD: 15 credits, 4K: 25 credits)');
      console.log('  • Avatar creation (5 credits each)');
    }
  } catch (error) {
    console.error('\n❌ Error updating test user credits:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

ensureTestUserCredits().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

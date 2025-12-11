import { Handler } from 'aws-lambda';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users, paymentTransactions, creditPurchases } from '@shared/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

/**
 * Lambda handler for processing Stripe webhook events
 * Triggered by EventBridge from the main webhook receiver
 */
export const handler: Handler = async (event) => {
  console.log('Processing Stripe webhook event:', event['detail-type']);
  
  const stripeEvent = event.detail as Stripe.Event;
  
  try {
    // Connect to database
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    const db = drizzle(connection);
    
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(db, stripeEvent.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(db, stripeEvent.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, stripeEvent.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(db, stripeEvent.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
    
    await connection.end();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
};

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutCompleted(db: any, session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  
  if (!userId) {
    console.error('No user ID found in checkout session');
    return;
  }
  
  console.log(`Processing checkout completion for user ${userId}`);
  
  // Check if this is a credit purchase or subscription
  if (session.mode === 'payment' && session.metadata?.type === 'credit_purchase') {
    // Handle one-time credit purchase
    const credits = parseInt(session.metadata.credits || '0');
    const bonusCredits = parseInt(session.metadata.bonusCredits || '0');
    const totalCredits = credits + bonusCredits;
    
    // Add credits to user account
    await db
      .update(users)
      .set({
        creditsRemaining: db.$increment(users.creditsRemaining, totalCredits),
      })
      .where(eq(users.id, userId));
    
    // Record the purchase
    await db.insert(creditPurchases).values({
      userId,
      creditsPurchased: credits,
      bonusCredits,
      amountPaid: (session.amount_total || 0) / 100, // Convert cents to dollars
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      status: 'completed',
      completedAt: new Date(),
    });
    
    // Record transaction
    await db.insert(paymentTransactions).values({
      userId,
      type: 'credit_purchase',
      amount: (session.amount_total || 0) / 100,
      creditsAmount: totalCredits,
      stripePaymentId: session.payment_intent as string,
      status: 'completed',
      metadata: JSON.stringify({
        credits,
        bonusCredits,
        sessionId: session.id,
      }),
    });
    
    console.log(`Added ${totalCredits} credits to user ${userId}`);
    
  } else if (session.mode === 'subscription') {
    // Handle subscription creation
    const subscriptionId = session.subscription as string;
    
    // Update user's trial status to converted
    await db
      .update(users)
      .set({
        trialStatus: 'converted',
        subscriptionTier: session.metadata?.planId || 'studio',
      })
      .where(eq(users.id, userId));
    
    console.log(`User ${userId} upgraded to ${session.metadata?.planId} plan`);
    
    // Record transaction
    await db.insert(paymentTransactions).values({
      userId,
      type: 'subscription',
      amount: (session.amount_total || 0) / 100,
      stripePaymentId: session.payment_intent as string,
      status: 'completed',
      metadata: JSON.stringify({
        planId: session.metadata?.planId,
        billingCycle: session.metadata?.billingCycle,
        subscriptionId,
        sessionId: session.id,
      }),
    });
  }
}

/**
 * Handle subscription updates (plan changes, renewals, etc.)
 */
async function handleSubscriptionUpdated(db: any, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    console.warn('No user ID in subscription metadata');
    return;
  }
  
  console.log(`Processing subscription update for user ${userId}`);
  
  // Update subscription tier based on status
  if (subscription.status === 'active') {
    const planId = subscription.metadata?.planId || 'studio';
    
    await db
      .update(users)
      .set({
        subscriptionTier: planId,
        trialStatus: 'converted',
      })
      .where(eq(users.id, userId));
    
    console.log(`Updated user ${userId} subscription status to active`);
  } else if (subscription.status === 'past_due') {
    console.log(`Subscription past due for user ${userId}`);
    // Note: User keeps access until subscription is actually canceled
  }
}

/**
 * Handle subscription deletion (cancellation or end of billing period)
 */
async function handleSubscriptionDeleted(db: any, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    console.warn('No user ID in subscription metadata');
    return;
  }
  
  console.log(`Processing subscription deletion for user ${userId}`);
  
  // Downgrade user to free tier
  await db
    .update(users)
    .set({
      subscriptionTier: 'free',
    })
    .where(eq(users.id, userId));
  
  console.log(`Downgraded user ${userId} to free tier`);
}

/**
 * Handle failed payment attempts
 */
async function handlePaymentFailed(db: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;
  
  console.log(`Payment failed for subscription ${subscriptionId}`);
  
  // Get subscription to find user ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    console.warn('No user ID found for failed payment');
    return;
  }
  
  // Record failed transaction
  await db.insert(paymentTransactions).values({
    userId,
    type: 'subscription',
    amount: (invoice.amount_due || 0) / 100,
    stripeInvoiceId: invoice.id,
    status: 'failed',
    metadata: JSON.stringify({
      subscriptionId,
      customerId,
      attemptCount: invoice.attempt_count,
    }),
  });
  
  console.log(`Recorded failed payment for user ${userId}`);
  
  // TODO: Send email notification to user about failed payment
}

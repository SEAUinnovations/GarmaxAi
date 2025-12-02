/**
 * Billing Processor Lambda Handler
 * 
 * Processes Stripe webhook events delivered via EventBridge -> SQS.
 * Handles subscription lifecycle, payment processing, and credit management.
 * 
 * ARCHITECTURE OVERVIEW:
 * ===================
 * 1. Stripe webhook sends events to API Gateway endpoint
 * 2. API publishes validated events to EventBridge custom bus
 * 3. EventBridge routes billing events to SQS billing queue
 * 4. This Lambda processes events from SQS with automatic retries and DLQ
 * 
 * EVENT CONTRACT:
 * ==============
 * SQS message structure (EventBridge -> SQS target):
 * {
 *   source: 'stripe',
 *   detail-type: 'checkout.session.completed' | 'invoice.payment_succeeded' | etc,
 *   detail: {
 *     // Full Stripe event object
 *     id: 'evt_...',
 *     type: 'checkout.session.completed',
 *     data: {
 *       object: { ... } // Stripe resource (subscription, invoice, etc)
 *     }
 *   }
 * }
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';

interface EventBridgeMessage {
  source?: string;
  'detail-type'?: string;
  detailType?: string;
  detail?: StripeEvent;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  [key: string]: any;
}

interface LambdaResponse {
  statusCode: number;
  body?: string;
}

export const handler = async (event: SQSEvent): Promise<LambdaResponse> => {
  console.log('[billingProcessor] Processing batch', {
    recordCount: event.Records?.length || 0
  });

  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('[billingProcessor] Failed to process record', {
        messageId: record.messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Let Lambda return error to re-drive message per SQS retry/DLQ policy
      throw error;
    }
  }

  return { statusCode: 200 };
};

async function processRecord(record: SQSRecord): Promise<void> {
  const body: EventBridgeMessage = JSON.parse(record.body);
  
  // If delivered via EventBridge target to SQS, the message is in body
  // EventBridge SQS target wraps the event under body (already parsed)
  const detail = body?.detail || (body as any); // fallback if sent directly
  const source = body?.source;
  const detailType = body?.['detail-type'] || body?.detailType;

  console.log('[billingProcessor] Received event', { 
    source, 
    detailType,
    eventId: detail?.id 
  });

  // Full Stripe event object
  const stripeEvent: StripeEvent = detail;

  // Route to appropriate handler based on event type
  switch (detailType) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripeEvent);
      break;
    
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(stripeEvent);
      break;
    
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(stripeEvent);
      break;
    
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(stripeEvent);
      break;
    
    default:
      console.log('[billingProcessor] Unhandled event type', { detailType });
      break;
  }
}

/**
 * Handle successful checkout session
 * Grant credits or activate subscription based on purchase
 */
async function handleCheckoutCompleted(event: StripeEvent): Promise<void> {
  console.log('[billingProcessor] Processing checkout.session.completed', {
    sessionId: event.data.object.id
  });
  
  // TODO: Implement credit granting / subscription activation
  // - Use event.id for idempotency (check if already processed)
  // - Extract customer_id, subscription_id, or payment_intent
  // - Update user's subscription tier or credit balance in database
  // - Send confirmation email/notification
  
  console.warn('[billingProcessor] TODO: Implement checkout completion handler');
}

/**
 * Handle successful invoice payment
 * Mark invoice as paid and extend subscription period
 */
async function handleInvoicePaymentSucceeded(event: StripeEvent): Promise<void> {
  console.log('[billingProcessor] Processing invoice.payment_succeeded', {
    invoiceId: event.data.object.id
  });
  
  // TODO: Implement invoice payment handling
  // - Update subscription current_period_end
  // - Reset quota counters for new billing period
  // - Record payment in transaction history
  
  console.warn('[billingProcessor] TODO: Implement invoice payment handler');
}

/**
 * Handle subscription updates
 * Sync subscription status, plan changes, or quota updates
 */
async function handleSubscriptionUpdated(event: StripeEvent): Promise<void> {
  console.log('[billingProcessor] Processing customer.subscription.updated', {
    subscriptionId: event.data.object.id
  });
  
  // TODO: Implement subscription update sync
  // - Update user's subscription tier (free -> pro, etc)
  // - Adjust quotas based on new plan
  // - Handle plan upgrades/downgrades
  // - Update billing cycle dates
  
  console.warn('[billingProcessor] TODO: Implement subscription update handler');
}

/**
 * Handle subscription cancellation
 * Downgrade user to free tier or disable premium features
 */
async function handleSubscriptionDeleted(event: StripeEvent): Promise<void> {
  console.log('[billingProcessor] Processing customer.subscription.deleted', {
    subscriptionId: event.data.object.id
  });
  
  // TODO: Implement subscription cancellation
  // - Downgrade user to free tier
  // - Revoke premium feature access
  // - Send cancellation confirmation
  // - Archive subscription data for records
  
  console.warn('[billingProcessor] TODO: Implement subscription deletion handler');
}

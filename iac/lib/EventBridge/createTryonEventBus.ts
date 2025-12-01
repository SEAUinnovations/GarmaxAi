import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Stack } from 'aws-cdk-lib';
import { env } from '../../../parameters/config';

/**
 * Creates EventBridge custom bus for try-on event routing and processing coordination.
 * 
 * EVENT ARCHITECTURE:
 * ==================
 * This bus orchestrates the photo-to-3D try-on pipeline using event-driven patterns:
 * 
 * 1. ENTRY POINTS:
 *    - API Gateway publishes 'tryon.session.create' when user starts try-on
 *    - Stripe webhook publishes payment events after signature verification
 * 
 * 2. PROCESSING FLOW:
 *    tryon.session.create → SQS → tryonProcessor Lambda
 *      → generates SMPL guidance assets and preview
 *      → publishes 'tryon.render.requested'
 *    
 *    tryon.render.requested → aiRenderProcessor Lambda (direct invocation)
 *      → calls Replicate/Bedrock for photorealistic rendering
 *      → publishes 'tryon.render.completed' or 'tryon.render.failed'
 * 
 * 3. PAYMENT PROCESSING:
 *    stripe:* events → Billing SQS → billingProcessor Lambda
 *      → updates user credits, subscription status, quota limits
 * 
 * EVENT PAYLOAD SCHEMAS:
 * =====================
 * tryon.session.create:
 *   { sessionId, userId, inputs: { frontPhotoKey, sidePhotoKey, garmentRefs }, 
 *     preferences: { renderQuality, stylePrompt, fitPreference }, trace: { correlationId } }
 * 
 * tryon.render.requested:
 *   { sessionId, userId, inputs: { previewKey, guidanceKeys, garments }, 
 *     renderOptions: { quality, guidanceScale, steps }, output: { bucket, prefix }, trace }
 * 
 * stripe:* events:
 *   Raw Stripe webhook payloads after signature verification
 * 
 * RELIABILITY & ORDERING:
 * =======================
 * - SQS FIFO queues ensure ordered processing per session (messageGroupId)
 * - DLQ configured for failed processing with maxReceiveCount=3
 * - EventBridge guarantees at-least-once delivery with built-in retries
 * - Lambda targets use async invocation for better error handling
 * 
 * COST OPTIMIZATION:
 * ==================
 * - Rules can be disabled via feature flags during idle periods
 * - SQS batching reduces Lambda invocations for high-volume scenarios
 * - Direct Lambda invocation for render requests (low latency, no SQS overhead)
 */
export default function createTryonEventBus(
  stack: Stack,
  stage: string,
  tryonQueue: sqs.Queue,
  billingQueue?: sqs.Queue,
  tryonProcessor?: lambda.Function,
  aiRenderProcessor?: lambda.Function,
) {
  // Create custom EventBridge bus for try-on event coordination
  // Isolated from default bus to avoid cross-contamination and enable targeted monitoring
  const tryonEventBus = new events.EventBus(stack, `TryonEventBus-${stage}`, {
    eventBusName: `GarmaxAi-Tryon-${stage}`,
  });

  // RULE 1: Session Creation → Try-On Processing Queue
  // =================================================
  // Routes initial try-on requests from API Gateway to SQS for reliable processing.
  // 
  // Event Source: API endpoints (/api/tryon/sessions POST)
  // Event Pattern: source='garmax.tryon', detailType='tryon.session.create'
  // Target: SQS FIFO queue for ordered processing per session
  // 
  // Why SQS instead of direct Lambda?
  // - Handles traffic spikes and Lambda concurrency limits
  // - Built-in DLQ for retry handling on SMPL processing failures
  // - Allows batching multiple sessions for cost efficiency
  // - Decouples API response time from heavy SMPL processing
  const sessionCreateRule = new events.Rule(stack, `TryonSessionCreateRule-${stage}`, {
    eventBus: tryonEventBus,
    ruleName: `GarmaxAi-TryonSessionCreate-${stage}`,
    description: 'Route try-on session creation events to processing queue for SMPL estimation',
    eventPattern: {
      source: ['garmax.tryon'],
      detailType: ['tryon.session.create'],
    },
  });

  // Use messageGroupId for FIFO ordering - ensures sessions from same user are processed in sequence
  // This prevents race conditions when user creates multiple sessions rapidly
  sessionCreateRule.addTarget(new targets.SqsQueue(tryonQueue, {
    messageGroupId: 'tryon-sessions', // All sessions use same group for simplicity
  }));

  // RULE 2: Stripe Events → Billing Processing Queue
  // ================================================
  // Routes verified Stripe webhook events to billing processor for payment handling.
  // 
  // Event Source: Stripe webhook endpoint (/api/webhooks/stripe POST)
  // Event Pattern: source='stripe', detailType=<payment_events>
  // Target: Dedicated billing SQS queue (or fallback to main queue)
  // 
  // Security Note: Events only reach this rule AFTER webhook signature verification
  // in the paymentsRouter. Raw/unverified Stripe events are never processed.
  // 
  // Supported Event Types:
  // - checkout.session.completed: User completed purchase, add credits
  // - payment_intent.succeeded/failed: Payment processing results  
  // - invoice.payment_succeeded/failed: Subscription billing results
  // - customer.subscription.*: Plan changes, cancellations, renewals
  const stripeRule = new events.Rule(stack, `StripeEventsRule-${stage}`, {
    eventBus: tryonEventBus,
    ruleName: `GarmaxAi-StripeEvents-${stage}`,
    description: 'Route verified Stripe webhook events to billing processor for payment handling',
    eventPattern: {
      source: ['stripe'],
      detailType: [
        'checkout.session.completed',    // Purchase completion → add user credits
        'payment_intent.succeeded',      // Payment success confirmation
        'payment_intent.payment_failed', // Payment failure handling
        'invoice.payment_succeeded',     // Subscription payment success
        'invoice.payment_failed',        // Subscription payment failure → downgrade/suspend
        'customer.subscription.created', // New subscription activation
        'customer.subscription.updated', // Plan changes, quantity updates
        'customer.subscription.deleted', // Cancellation handling
      ],
    },
  });

  // Route to dedicated billing queue if available, otherwise fallback to main queue
  // messageGroupId ensures ordered processing of billing events per customer
  stripeRule.addTarget(new targets.SqsQueue(billingQueue ?? tryonQueue, {
    messageGroupId: 'stripe-events', // All billing events in same group for consistency
  }));

  // RULE 3: Render Requests → AI Render Processor (Direct Lambda)
  // ==============================================================
  // Routes render requests directly to AI processing Lambda for photorealistic generation.
  // 
  // Event Source: tryonProcessor Lambda after SMPL processing completes
  // Event Pattern: source='garmax.tryon', detailType='tryon.render.requested'
  // Target: aiRenderProcessor Lambda (direct async invocation)
  // 
  // Why Direct Lambda vs SQS?
  // - Lower latency for render requests (no SQS polling delay)
  // - Render processing is typically 1:1 (no batching benefits)
  // - Lambda handles retries internally with built-in DLQ support
  // - Simplifies monitoring and debugging of render pipeline
  // 
  // Provider Selection Logic (handled in aiRenderProcessor):
  // 1. Default: Replicate API (cost-effective, external scaling)
  // 2. Failover: Bedrock (only if ALLOW_BEDROCK_FAILOVER=true)
  // 3. Future: ECS GPU tasks for premium quality tiers
  if (aiRenderProcessor) {
    const renderRequestRule = new events.Rule(stack, `TryonRenderRequestRule-${stage}`, {
      eventBus: tryonEventBus,
      ruleName: `GarmaxAi-TryonRenderRequest-${stage}`,
      description: 'Route photorealistic render requests to AI processor with provider failover',
      eventPattern: {
        source: ['garmax.tryon'],
        detailType: ['tryon.render.requested'],
      },
    });

    // Direct Lambda invocation for low-latency processing
    // EventBridge automatically handles retries and DLQ on Lambda failures
    renderRequestRule.addTarget(new targets.LambdaFunction(aiRenderProcessor));
  }

  // RULE 4: Optional Direct Try-On Processing (Alternative Architecture)
  // ===================================================================
  // Alternative to SQS: direct Lambda invocation for try-on processing.
  // Currently DISABLED in favor of SQS-based approach for better reliability.
  // 
  // Use Cases for Direct Invocation:
  // - Low-volume environments where SQS overhead isn't justified
  // - Real-time processing requirements (immediate response needed)
  // - Simple deployments without complex retry/DLQ logic
  // 
  // Use Cases for SQS (current approach):
  // - High-volume production with traffic spikes
  // - Heavy SMPL processing that benefits from batching
  // - Complex retry scenarios and error handling
  // - Decoupling API response from processing time
  if (tryonProcessor) {
    const processingRule = new events.Rule(stack, `TryonProcessingRule-${stage}`, {
      eventBus: tryonEventBus,
      ruleName: `GarmaxAi-TryonProcessing-${stage}`,
      description: 'Alternative direct route for try-on events to processor Lambda (currently disabled)',
      eventPattern: {
        source: ['garmax.tryon'],
        detailType: ['tryon.session.create', 'tryon.render.requested'],
      },
    });

    // DISABLED: Uncomment to enable direct Lambda invocation instead of SQS
    // Trade-off: Lower latency vs. reduced reliability and traffic handling
    // processingRule.addTarget(new targets.LambdaFunction(tryonProcessor));
  }

  // Output event bus ARN
  new cdk.CfnOutput(stack, `TryonEventBusArn-${stage}`, {
    value: tryonEventBus.eventBusArn,
    exportName: `TryonEventBusArn-${stage}`,
    description: 'Try-On EventBridge Bus ARN',
  });

  new cdk.CfnOutput(stack, `TryonEventBusName-${stage}`, {
    value: tryonEventBus.eventBusName,
    exportName: `TryonEventBusName-${stage}`,
    description: 'Try-On EventBridge Bus Name',
  });

  return tryonEventBus;
}

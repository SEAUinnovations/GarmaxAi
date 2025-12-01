/**
 * Gemini Batch Queue Infrastructure
 * 
 * Creates SQS FIFO queue for reliable processing of Gemini batch completion events.
 * Mirrors the pattern established in createTryonQueue.ts with similar reliability guarantees.
 * 
 * ARCHITECTURE:
 * =============
 * EventBridge (gemini.batch.completed) → SQS FIFO Queue → Lambda (Result Distributor)
 * 
 * Why SQS instead of direct Lambda invocation?
 * - Automatic retry with exponential backoff
 * - Dead Letter Queue (DLQ) for failed messages
 * - Buffering during Lambda throttling or errors
 * - Ordered processing per batch (FIFO guarantees)
 * - Visibility timeout prevents duplicate processing
 * 
 * QUEUE CONFIGURATION:
 * ===================
 * - Type: FIFO (First-In-First-Out) for ordered batch result processing
 * - Deduplication: Content-based (prevents duplicate batch result processing)
 * - Visibility Timeout: 5 minutes (matches tryonQueue for consistency)
 * - Long Polling: 20 seconds (reduces empty receive costs)
 * - DLQ: Max 3 receive attempts before moving to dead letter queue
 * - Retention: 14 days for DLQ messages (allows manual recovery)
 * 
 * MESSAGE FLOW:
 * =============
 * 1. Gemini batch completes → batchImageService publishes event
 * 2. EventBridge routes to this SQS queue
 * 3. Lambda consumes messages (batch size: 5 for efficiency)
 * 4. Lambda distributes results to individual users
 * 5. On failure: retry up to 3 times, then move to DLQ
 * 6. DLQ messages trigger alerts for manual investigation
 */

import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Stack } from 'aws-cdk-lib';

export default function createGeminiBatchQueue(
  stack: Stack,
  stage: string,
) {
  /**
   * Dead Letter Queue (DLQ)
   * Stores messages that failed processing after max retry attempts
   * Enables manual investigation and recovery of failed batch results
   */
  const deadLetterQueue = new sqs.Queue(stack, `GeminiBatchDLQ-${stage}`, {
    queueName: `GarmaxAi-GeminiBatchDLQ-${stage}.fifo`,
    fifo: true,
    
    // Content-based deduplication prevents duplicate DLQ entries
    contentBasedDeduplication: true,
    
    // Keep failed messages for 14 days (max allowed)
    // Gives time for investigation and manual recovery
    retentionPeriod: cdk.Duration.days(14),
  });

  /**
   * Main Gemini Batch Processing Queue
   * Receives batch completion events from EventBridge
   * Processed by Lambda for result distribution to users
   */
  const geminiBatchQueue = new sqs.Queue(stack, `GeminiBatchProcessingQueue-${stage}`, {
    queueName: `GarmaxAi-GeminiBatchProcessing-${stage}.fifo`,
    fifo: true,
    
    // Content-based deduplication using message body hash
    // Prevents processing the same batch result twice
    contentBasedDeduplication: true,
    
    /**
     * Visibility Timeout: 5 minutes
     * How long a message is hidden from other consumers after being received
     * 
     * Why 5 minutes?
     * - Matches tryonQueue for consistency
     * - Allows time for result distribution to multiple users
     * - Handles S3 uploads and database updates
     * - Prevents duplicate processing if Lambda runs long
     */
    visibilityTimeout: cdk.Duration.minutes(5),
    
    /**
     * Long Polling: 20 seconds
     * How long SQS waits for messages before returning empty response
     * 
     * Benefits:
     * - Reduces costs (fewer empty API calls)
     * - Lowers latency (messages delivered faster)
     * - More efficient for consumers
     */
    receiveMessageWaitTime: cdk.Duration.seconds(20),
    
    /**
     * Dead Letter Queue Configuration
     * Messages move to DLQ after 3 failed processing attempts
     * 
     * Retry strategy:
     * 1. First attempt: Immediate processing
     * 2. Second attempt: After visibility timeout (5 min)
     * 3. Third attempt: After another visibility timeout (5 min)
     * 4. Move to DLQ: After 3rd failure
     */
    deadLetterQueue: {
      queue: deadLetterQueue,
      maxReceiveCount: 3, // Retry up to 3 times before giving up
    },
  });

  /**
   * CloudFormation Outputs
   * Export queue URLs and ARNs for use in other stacks
   * Used by EventBridge rules and Lambda event source mappings
   */
  
  // Queue URL output (used by Lambda consumers)
  new cdk.CfnOutput(stack, `GeminiBatchQueueUrl-${stage}`, {
    value: geminiBatchQueue.queueUrl,
    exportName: `GeminiBatchQueueUrl-${stage}`,
    description: 'Gemini Batch Processing Queue URL',
  });

  // Queue ARN output (used by EventBridge targets)
  new cdk.CfnOutput(stack, `GeminiBatchQueueArn-${stage}`, {
    value: geminiBatchQueue.queueArn,
    exportName: `GeminiBatchQueueArn-${stage}`,
    description: 'Gemini Batch Processing Queue ARN',
  });

  // DLQ URL output (for monitoring and manual recovery)
  new cdk.CfnOutput(stack, `GeminiBatchDLQUrl-${stage}`, {
    value: deadLetterQueue.queueUrl,
    exportName: `GeminiBatchDLQUrl-${stage}`,
    description: 'Gemini Batch Dead Letter Queue URL',
  });

  /**
   * Return queue objects for use in stack wiring
   * Main queue will be connected to:
   * 1. EventBridge target (for receiving batch events)
   * 2. Lambda event source (for processing messages)
   */
  return { geminiBatchQueue, deadLetterQueue };
}

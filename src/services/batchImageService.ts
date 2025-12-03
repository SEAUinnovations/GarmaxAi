/**
 * Batch Image Service
 * 
 * Orchestrates hybrid batch processing for Gemini Imagen 3 image generation.
 * Extends the debouncing pattern from DebouncedRenderService with larger batch sizes.
 * 
 * OVERVIEW:
 * =========
 * This service accumulates individual render requests into batches to optimize API costs
 * and throughput. Uses a hybrid trigger strategy: batches submit when EITHER condition is met:
 * 1. Maximum batch size reached (50 images)
 * 2. Timeout expires (45 seconds)
 * 
 * HYBRID BATCHING STRATEGY:
 * =========================
 * Fixed settings for initial 2-week rollout (no dynamic adjustment):
 * 
 * MAX_BATCH_SIZE = 50 images
 *   - Why 50? Balances throughput and latency
 *   - Smaller batches = faster user feedback but higher per-image overhead
 *   - Larger batches = better cost efficiency but longer wait times
 *   - 50 is sweet spot for typical traffic patterns
 * 
 * BATCH_TIMEOUT = 45 seconds
 *   - Why 45s? Prevents indefinite waiting during low traffic
 *   - Users see results within 1 minute even if batch isn't full
 *   - Short enough for acceptable UX, long enough to accumulate requests
 *   - Measured from when first request enters queue
 * 
 * WHICHEVER COMES FIRST:
 *   - If 50th request arrives after 10 seconds → submit immediately
 *   - If only 20 requests after 45 seconds → submit with 20 images
 *   - Adaptive to traffic: busy periods = full batches, slow periods = timeout-triggered
 * 
 * WORKFLOW:
 * =========
 * 1. Request arrives → add to pending queue
 * 2. Start timeout timer (if first request in batch)
 * 3. When trigger condition met:
 *    a. Extract pending requests (up to 50)
 *    b. Create batch job record in RDS
 *    c. Submit to Gemini API via geminiImageService
 *    d. Poll for completion using adaptive strategy
 *    e. Publish results to EventBridge for distribution
 * 4. Individual requests routed to users via existing aiRenderProcessor
 * 
 * DATABASE TRACKING:
 * =================
 * Each batch creates a record in gemini_batch_jobs table:
 * - Tracks all request IDs in the batch
 * - Monitors status progression (pending → submitted → processing → completed)
 * - Records cost and timing metrics
 * - Enables user queries ("where's my render?")
 * - Supports retry logic on failures
 * 
 * EVENTBRIDGE INTEGRATION:
 * =======================
 * Publishes events for batch lifecycle:
 * 
 * gemini.batch.submitted:
 *   - When batch sent to Gemini API
 *   - Payload: { batchId, requestCount, userId, estimatedCost }
 * 
 * gemini.batch.completed:
 *   - When all images in batch are ready
 *   - Payload: { batchId, results: [{ requestId, imageUrl, cost }], totalCost }
 *   - Triggers distribution to individual users
 * 
 * gemini.batch.failed:
 *   - When batch processing fails
 *   - Payload: { batchId, errorMessage, failedRequestIds }
 *   - Triggers fallback to PhotoMaker/SDXL
 * 
 * VALIDATION CRITERIA (for traffic rollout):
 * =========================================
 * Before increasing GEMINI_TRAFFIC_PERCENT, verify:
 * 1. Cost per image < $0.05 (target: $0.025-0.045)
 * 2. P95 latency < 60 seconds (measured from request to result)
 * 3. Batch failure rate < 5% (completed / submitted)
 * 4. Quality parity score > 0.9 vs Replicate Nano Banana Pro
 * 
 * Rollout phases:
 * - 10% traffic: 3 days + 500 images minimum
 * - 50% traffic: 7 days + 2000 images minimum
 * - 100% traffic: Full production after validation
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { db } from '../storage/storageFactory';
import { geminiBatchJobs } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/winston-logger';
import { geminiImageService, GeminiImageRequest, GeminiBatchRequest } from './geminiImageService';
import { randomUUID } from 'crypto';

// AWS EventBridge client for publishing batch events
const eventBridgeClient = new EventBridgeClient({});

// Environment configuration
const STAGE = process.env.STAGE || 'dev';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || `GarmaxAi-Tryon-${STAGE}`;
const GEMINI_MAX_BATCH_SIZE = parseInt(process.env.GEMINI_MAX_BATCH_SIZE || '50');
const GEMINI_BATCH_TIMEOUT_MS = parseInt(process.env.GEMINI_BATCH_TIMEOUT_MS || '45000');

/**
 * Individual render request queued for batching
 */
interface QueuedRequest {
  id: string;                    // Unique request ID
  userId: string;                // User ID for quota tracking
  request: GeminiImageRequest;   // Image generation parameters
  queuedAt: number;              // Timestamp when added to queue
  batchId?: string;              // Assigned batch ID (once batched)
}

/**
 * Batch Image Service
 * Manages request queue and batch submission
 */
class BatchImageService {
  // Request queue: Map<requestId, QueuedRequest>
  private pendingRequests = new Map<string, QueuedRequest>();
  
  // Batch timeout timer
  private batchTimer: NodeJS.Timeout | null = null;
  
  // First request timestamp (for timeout calculation)
  private batchStartTime: number = 0;
  
  // Processing lock to prevent concurrent batch submissions
  private isProcessingBatch = false;

  /**
   * Add a render request to the batch queue
   * Triggers batch submission if max size reached
   * 
   * @param userId - User ID for tracking and quotas
   * @param imageRequest - Image generation parameters
   * @returns Request ID for status tracking
   */
  async queueRequest(userId: string, imageRequest: GeminiImageRequest): Promise<string> {
    // Generate unique request ID
    const requestId = randomUUID();
    
    const queuedRequest: QueuedRequest = {
      id: requestId,
      userId,
      request: imageRequest,
      queuedAt: Date.now(),
    };

    // Add to pending queue
    this.pendingRequests.set(requestId, queuedRequest);

    logger.info(
      `Queued request ${requestId} for user ${userId}. Queue depth: ${this.pendingRequests.size}`,
      'BatchImageService'
    );

    // Start batch timer if this is the first request
    if (this.pendingRequests.size === 1) {
      this.startBatchTimer();
    }

    // Check if we've reached max batch size → submit immediately
    if (this.pendingRequests.size >= GEMINI_MAX_BATCH_SIZE) {
      logger.info(
        `Max batch size (${GEMINI_MAX_BATCH_SIZE}) reached. Triggering immediate submission.`,
        'BatchImageService'
      );
      
      // Clear timer since we're submitting now
      this.clearBatchTimer();
      
      // Submit batch asynchronously (don't block request queueing)
      setImmediate(() => this.processBatch());
    }

    return requestId;
  }

  /**
   * Start batch timeout timer
   * Timer triggers batch submission after GEMINI_BATCH_TIMEOUT_MS
   */
  private startBatchTimer(): void {
    this.batchStartTime = Date.now();
    
    logger.info(
      `Starting batch timer: ${GEMINI_BATCH_TIMEOUT_MS}ms`,
      'BatchImageService'
    );

    this.batchTimer = setTimeout(() => {
      logger.info(
        `Batch timeout reached (${GEMINI_BATCH_TIMEOUT_MS}ms). Submitting ${this.pendingRequests.size} requests.`,
        'BatchImageService'
      );
      
      this.processBatch();
    }, GEMINI_BATCH_TIMEOUT_MS);
  }

  /**
   * Clear batch timeout timer
   */
  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Process pending requests as a batch
   * Main orchestration method for batch submission
   */
  private async processBatch(): Promise<void> {
    // Prevent concurrent batch processing
    if (this.isProcessingBatch) {
      logger.warn('Batch already processing, skipping duplicate submission', 'BatchImageService');
      return;
    }

    // Check if there are any pending requests
    if (this.pendingRequests.size === 0) {
      logger.info('No pending requests to process', 'BatchImageService');
      return;
    }

    this.isProcessingBatch = true;

    try {
      // Extract requests from queue (up to MAX_BATCH_SIZE)
      const requestsToProcess = Array.from(this.pendingRequests.values())
        .slice(0, GEMINI_MAX_BATCH_SIZE);

      // Remove processed requests from pending queue
      requestsToProcess.forEach(req => this.pendingRequests.delete(req.id));

      logger.info(
        `Processing batch with ${requestsToProcess.length} requests. Remaining in queue: ${this.pendingRequests.size}`,
        'BatchImageService'
      );

      // Generate unique batch ID
      const batchId = `batch-${Date.now()}-${randomUUID().substring(0, 8)}`;

      // Group requests by user for quota tracking
      const userRequests = new Map<string, number>();
      requestsToProcess.forEach(req => {
        const count = userRequests.get(req.userId) || 0;
        userRequests.set(req.userId, count + 1);
      });

      logger.info(
        `Batch ${batchId} breakdown: ${Array.from(userRequests.entries()).map(([userId, count]) => `${userId}:${count}`).join(', ')}`,
        'BatchImageService'
      );

      // Create batch job record in RDS database
      // This enables status tracking and user queries
      await db.insert(geminiBatchJobs).values({
        batchId,
        userId: requestsToProcess[0].userId, // Primary user (for billing)
        requestIds: requestsToProcess.map(req => req.id),
        status: 'pending',
        imageCount: requestsToProcess.length,
        retryCount: 0,
      });

      logger.info(`Created database record for batch ${batchId}`, 'BatchImageService');

      // Build Gemini batch request
      const batchRequest: GeminiBatchRequest = {
        batchId,
        userId: requestsToProcess[0].userId,
        requests: requestsToProcess.map(req => req.request),
      };

      // Submit batch to Gemini API
      const geminiBatchId = await geminiImageService.submitBatch(batchRequest);

      // Update database with submitted status and Gemini batch ID
      await db.update(geminiBatchJobs)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          batchId: geminiBatchId, // Update with actual Gemini batch ID
        })
        .where(eq(geminiBatchJobs.batchId, batchId));

      // Publish batch submission event to EventBridge
      await this.publishBatchEvent('gemini.batch.submitted', {
        batchId: geminiBatchId,
        requestCount: requestsToProcess.length,
        requestIds: requestsToProcess.map(req => req.id),
        userId: requestsToProcess[0].userId,
      });

      logger.info(`Batch ${batchId} submitted to Gemini API. Starting polling...`, 'BatchImageService');

      // Poll for batch completion (runs asynchronously)
      // Results will be published via EventBridge when ready
      this.pollBatchCompletion(batchId, geminiBatchId, requestsToProcess);

      // Restart timer if there are still pending requests
      if (this.pendingRequests.size > 0) {
        this.startBatchTimer();
      }

    } catch (error: any) {
      logger.error(`Batch processing failed: ${error.message}`, 'BatchImageService');
      
      // TODO: Implement fallback logic (retry or route to PhotoMaker)
      
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Poll for batch completion and publish results
   * Runs asynchronously after batch submission
   * 
   * @param internalBatchId - Our database batch ID
   * @param geminiBatchId - Gemini API batch ID
   * @param requests - Original requests in this batch
   */
  private async pollBatchCompletion(
    internalBatchId: string,
    geminiBatchId: string,
    requests: QueuedRequest[]
  ): Promise<void> {
    try {
      // Update database status to processing
      await db.update(geminiBatchJobs)
        .set({ status: 'processing' })
        .where(eq(geminiBatchJobs.batchId, internalBatchId));

      // Poll Gemini API for batch status using adaptive intervals
      const batchStatus = await geminiImageService.pollBatchStatus(geminiBatchId);

      if (batchStatus.status === 'completed' && batchStatus.results) {
        // Calculate total cost
        const totalCost = batchStatus.results.reduce((sum, result) => sum + result.cost, 0);

        // Update database with completion details
        await db.update(geminiBatchJobs)
          .set({
            status: 'completed',
            completedAt: new Date(),
            costUsd: totalCost.toString(),
          })
          .where(eq(geminiBatchJobs.batchId, internalBatchId));

        // Publish completion event with results
        // This triggers individual result distribution via existing aiRenderProcessor
        await this.publishBatchEvent('gemini.batch.completed', {
          batchId: geminiBatchId,
          internalBatchId,
          results: batchStatus.results.map((result, index) => ({
            requestId: requests[index].id,
            userId: requests[index].userId,
            imageUrl: result.imageUrl,
            cost: result.cost,
            timeTaken: result.timeTaken,
            metadata: result.metadata,
          })),
          totalCost,
          completedCount: batchStatus.completedCount,
          totalCount: batchStatus.totalCount,
        });

        logger.info(
          `Batch ${internalBatchId} completed successfully. Cost: $${totalCost.toFixed(4)}`,
          'BatchImageService'
        );

      } else if (batchStatus.status === 'failed') {
        // Update database with failure status
        await db.update(geminiBatchJobs)
          .set({
            status: 'failed',
            errorMessage: batchStatus.errorMessage || 'Unknown error',
            completedAt: new Date(),
          })
          .where(eq(geminiBatchJobs.batchId, internalBatchId));

        // Publish failure event for fallback handling
        // This will trigger PhotoMaker/SDXL fallback for each request
        await this.publishBatchEvent('gemini.batch.failed', {
          batchId: geminiBatchId,
          internalBatchId,
          errorMessage: batchStatus.errorMessage,
          failedRequestIds: requests.map(req => req.id),
          userIds: requests.map(req => req.userId),
        });

        logger.error(
          `Batch ${internalBatchId} failed: ${batchStatus.errorMessage}`,
          'BatchImageService'
        );
      }

    } catch (error: any) {
      logger.error(
        `Batch completion polling failed for ${internalBatchId}: ${error.message}`,
        'BatchImageService'
      );

      // Update database with error
      await db.update(geminiBatchJobs)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        })
        .where(eq(geminiBatchJobs.batchId, internalBatchId))
        .catch((err: any) => logger.error(`Failed to update batch status: ${err}`, 'BatchImageService'));
    }
  }

  /**
   * Publish batch event to EventBridge
   * Events are consumed by aiRenderProcessor and other handlers
   * 
   * @param eventType - Event type (submitted, completed, failed)
   * @param detail - Event payload
   */
  private async publishBatchEvent(eventType: string, detail: any): Promise<void> {
    try {
      const command = new PutEventsCommand({
        Entries: [{
          Source: 'garmax.gemini',
          DetailType: eventType,
          Detail: JSON.stringify(detail),
          EventBusName: EVENT_BUS_NAME,
        }],
      });

      await eventBridgeClient.send(command);

      logger.info(`Published event: ${eventType}`, 'BatchImageService');

    } catch (error: any) {
      logger.error(`Failed to publish event ${eventType}: ${error.message}`, 'BatchImageService');
      // Don't throw - event publishing failure shouldn't block batch processing
    }
  }

  /**
   * Get current queue status for monitoring
   * 
   * @returns Queue metrics
   */
  getQueueStatus(): {
    pendingCount: number;
    batchProgress: number;
    estimatedWaitTime: number;
  } {
    const pendingCount = this.pendingRequests.size;
    
    // Calculate how full the current batch is
    const batchProgress = Math.min((pendingCount / GEMINI_MAX_BATCH_SIZE) * 100, 100);
    
    // Estimate wait time based on timeout or batch size
    let estimatedWaitTime: number;
    if (this.batchStartTime > 0) {
      // Batch in progress - time until timeout
      const elapsed = Date.now() - this.batchStartTime;
      estimatedWaitTime = Math.max(0, GEMINI_BATCH_TIMEOUT_MS - elapsed);
    } else {
      // No batch yet - will start when first request arrives
      estimatedWaitTime = GEMINI_BATCH_TIMEOUT_MS;
    }

    return {
      pendingCount,
      batchProgress,
      estimatedWaitTime,
    };
  }

  /**
   * Get batch job status from database
   * 
   * @param requestId - Request ID to look up
   * @returns Batch job info or null
   */
  async getRequestStatus(requestId: string): Promise<any> {
    try {
      // Check if request is still in pending queue
      if (this.pendingRequests.has(requestId)) {
        return {
          status: 'queued',
          queuedAt: this.pendingRequests.get(requestId)?.queuedAt,
          queuePosition: Array.from(this.pendingRequests.keys()).indexOf(requestId) + 1,
          queueSize: this.pendingRequests.size,
        };
      }

      // Query database for submitted/completed batches
      // Note: This requires JSON query capabilities in Drizzle ORM
      // Implementation may need raw SQL for JSON array search
      
      // Placeholder: Return null if not found
      // TODO: Implement JSON array search for request_ids column
      
      return null;

    } catch (error: any) {
      logger.error(`Failed to get request status: ${error.message}`, 'BatchImageService');
      return null;
    }
  }
}

// Export singleton instance
export const batchImageService = new BatchImageService();

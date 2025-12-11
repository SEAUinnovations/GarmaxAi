import axios from 'axios';
import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import { generateSignature } from '../utils/webhookSignature';
import type { WebhookEvent } from '../types/enterprise';

/**
 * Service for managing webhook configurations and delivery
 */

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s
const MAX_FAILURE_COUNT = 10;
const WEBHOOK_TIMEOUT = 30000; // 30 seconds

/**
 * Deliver webhook event to configured URL
 */
async function deliverWebhook(
  url: string,
  secret: string,
  event: WebhookEvent,
  attempt: number = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const payload = JSON.stringify(event);
    const signature = generateSignature(payload, secret);

    logger.info(
      `Delivering webhook (attempt ${attempt}/${MAX_RETRIES}): ${event.event} to ${url}`,
      'WebhookService'
    );

    const response = await axios.post(url, event, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.event,
        'X-Webhook-Timestamp': event.timestamp,
        'User-Agent': 'GarmaxAI-Webhook/1.0'
      },
      timeout: WEBHOOK_TIMEOUT,
      validateStatus: (status) => status >= 200 && status < 300
    });

    logger.info(
      `Webhook delivered successfully: ${event.event} (status: ${response.status})`,
      'WebhookService'
    );

    return { success: true, statusCode: response.status };
  } catch (error) {
    const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
    const errorMessage = axios.isAxiosError(error) 
      ? `${error.message} (status: ${statusCode})`
      : (error as Error).message;

    logger.error(
      `Webhook delivery failed (attempt ${attempt}): ${errorMessage}`,
      'WebhookService'
    );

    // Retry logic
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1];
      logger.info(`Retrying webhook in ${delay}ms...`, 'WebhookService');
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return deliverWebhook(url, secret, event, attempt + 1);
    }

    return { 
      success: false, 
      statusCode,
      error: errorMessage 
    };
  }
}

/**
 * Send webhook event to organization's configured endpoints
 */
export async function sendWebhookEvent(
  organizationId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    // Get webhook configurations for this organization
    const webhooks = await storage.listWebhooks(organizationId);

    if (!webhooks || webhooks.length === 0) {
      logger.debug(
        `No webhooks configured for organization ${organizationId}`,
        'WebhookService'
      );
      return;
    }

    // Filter webhooks subscribed to this event type
    const subscribedWebhooks = webhooks.filter(webhook => 
      webhook.status === 'active' && 
      webhook.events.includes(eventType)
    );

    if (subscribedWebhooks.length === 0) {
      logger.debug(
        `No active webhooks subscribed to ${eventType} for org ${organizationId}`,
        'WebhookService'
      );
      return;
    }

    // Create webhook event payload
    const webhookEvent: WebhookEvent = {
      event: eventType as any,
      timestamp: new Date().toISOString(),
      data: eventData
    };

    // Deliver to all subscribed webhooks (async, don't await)
    for (const webhook of subscribedWebhooks) {
      deliverWebhook(webhook.url, webhook.secret, webhookEvent)
        .then(async (result) => {
          if (result.success) {
            // Update success timestamp
            await storage.updateWebhook(webhook.id, {
              lastSuccessAt: new Date(),
              failureCount: 0
            });
          } else {
            // Increment failure count
            const newFailureCount = (webhook.failureCount || 0) + 1;
            const updates: any = {
              failureCount: newFailureCount,
              lastFailureAt: new Date()
            };

            // Auto-disable after max failures
            if (newFailureCount >= MAX_FAILURE_COUNT) {
              updates.status = 'disabled';
              logger.warn(
                `Webhook ${webhook.id} disabled after ${MAX_FAILURE_COUNT} failures`,
                'WebhookService'
              );
            }

            await storage.updateWebhook(webhook.id, updates);
          }
        })
        .catch(error => {
          logger.error(
            `Error updating webhook status: ${error}`,
            'WebhookService'
          );
        });
    }

    logger.info(
      `Dispatched ${eventType} webhook to ${subscribedWebhooks.length} endpoint(s)`,
      'WebhookService'
    );
  } catch (error) {
    logger.error(
      `Error sending webhook event: ${error}`,
      'WebhookService'
    );
    // Don't throw - webhooks should not block main operations
  }
}

/**
 * Test webhook endpoint
 */
export async function testWebhook(
  url: string,
  secret: string
): Promise<{ success: boolean; statusCode?: number; error?: string; responseTime?: number }> {
  try {
    const startTime = Date.now();
    
    const testEvent: WebhookEvent = {
      event: 'webhook.test' as any,
      timestamp: new Date().toISOString(),
      data: {
        organizationId: '',
        currentCredits: 0,
        threshold: 0
      } as any
    };

    const result = await deliverWebhook(url, secret, testEvent, 1);
    const responseTime = Date.now() - startTime;

    return {
      ...result,
      responseTime
    };
  } catch (error) {
    logger.error(`Error testing webhook: ${error}`, 'WebhookService');
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Trigger try-on completed webhook
 */
export async function triggerTryonCompletedWebhook(
  organizationId: string,
  sessionId: string,
  sessionData: any
): Promise<void> {
  await sendWebhookEvent(organizationId, 'tryon.completed', {
    sessionId,
    status: 'completed',
    ...sessionData
  });
}

/**
 * Trigger try-on failed webhook
 */
export async function triggerTryonFailedWebhook(
  organizationId: string,
  sessionId: string,
  error: string
): Promise<void> {
  await sendWebhookEvent(organizationId, 'tryon.failed', {
    sessionId,
    status: 'failed',
    error
  });
}

/**
 * Trigger credits low webhook
 */
export async function triggerCreditsLowWebhook(
  organizationId: string,
  currentCredits: number,
  threshold: number
): Promise<void> {
  await sendWebhookEvent(organizationId, 'credits.low', {
    currentCredits,
    threshold,
    message: `Organization credits (${currentCredits}) below threshold (${threshold})`
  });
}

export const webhookService = {
  sendWebhookEvent,
  testWebhook,
  triggerTryonCompletedWebhook,
  triggerTryonFailedWebhook,
  triggerCreditsLowWebhook
};

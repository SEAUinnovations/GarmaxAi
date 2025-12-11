import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { logger } from '../utils/winston-logger';
import { storage } from '../storage';
import { cartTryonService } from './cartTryonService';
import { eventBridgeService } from './eventBridgeService';
import { webhookService } from './webhookService';
import type { CartTryonSession } from '@shared/schema';
import type { CartItem } from '../types/enterprise';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

/**
 * Service for processing cart try-on sessions
 * Downloads product images, converts to internal format, invokes SMPL pipeline
 */

/**
 * Download image from URL and upload to S3
 */
async function downloadAndUploadImage(
  imageUrl: string,
  s3Key: string
): Promise<string> {
  try {
    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'GarmaxAi-Bot/1.0'
      }
    });

    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
    }));

    const s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
    
    logger.info(`Downloaded and uploaded image: ${imageUrl} -> ${s3Key}`, 'CartTryonProcessor');
    
    return s3Url;
  } catch (error) {
    logger.error(`Error downloading image ${imageUrl}: ${error}`, 'CartTryonProcessor');
    throw error;
  }
}

/**
 * Process a single cart item try-on
 */
async function processCartItem(
  session: CartTryonSession,
  item: { productId: string; variantId: string; name: string; imageUrl: string; category: string; quantity: number; price: number; currency: string },
  itemIndex: number
): Promise<{ success: boolean; resultUrl?: string; error?: string }> {
  try {
    const orgId = session.organizationId;
    const garmentId = `cart-${session.id}-item-${itemIndex}`;
    
    // Download product image to S3
    const garmentS3Key = `enterprise/org-${orgId}/garments/${garmentId}.jpg`;
    const garmentS3Url = await downloadAndUploadImage(item.imageUrl, garmentS3Key);

    // Create garment record in database
    // Note: Using enterprise pattern for userId
    const enterpriseUserId = `org-${orgId}-cart-${session.cartId}`;
    
    const garment = await storage.createGarment({
      userId: enterpriseUserId,
      name: item.name,
      category: item.category,
      imageUrl: garmentS3Url,
      s3Key: garmentS3Key,
      tags: [item.productId, item.variantId, 'cart-tryon']
    });

    // Get customer photo
    const customerPhotoId = session.customerPhotoS3Key.split('/').pop()?.replace(/\.[^/.]+$/, '') || nanoid();
    
    // Create TryonSession and trigger SMPL processing via EventBridge
    const tryonSession = await storage.createTryonSession?.({
      userId: enterpriseUserId,
      avatarId: null,
      photoId: customerPhotoId,
      garmentIds: [garment.id],
      overlayGarmentIds: [],
      promptGarmentIds: [garment.id],
      renderQuality: session.renderQuality || 'hd',
      backgroundScene: session.backgroundScene || 'studio',
      customBackgroundPrompt: null,
      status: 'queued',
      progress: 0,
      creditsUsed: 0, // Already deducted at cart level
      usedQuota: false
    });

    if (tryonSession) {
      // Publish to EventBridge to trigger SMPL processing
      await eventBridgeService.publishTryonEvent(tryonSession);
      
      logger.info(
        `Created try-on session ${tryonSession.id} for cart item ${itemIndex}: ${item.name}`,
        'CartTryonProcessor'
      );
    } else {
      throw new Error('Failed to create tryon session');
    }

    return { success: true };
  } catch (error) {
    logger.error(
      `Error processing cart item ${itemIndex}: ${error}`,
      'CartTryonProcessor'
    );
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
}

/**
 * Process entire cart try-on session
 * Processes items sequentially or in parallel based on configuration
 */
export async function processCartTryonSession(
  sessionId: string
): Promise<void> {
  try {
    const session = await storage.getCartTryonSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'queued') {
      logger.warn(
        `Session ${sessionId} already processing (status: ${session.status})`,
        'CartTryonProcessor'
      );
      return;
    }

    // Update status to processing
    await cartTryonService.updateCartTryonSession(
      sessionId,
      session.organizationId,
      {
        status: 'processing',
        progress: 0
      }
    );

    logger.info(
      `Processing cart try-on session ${sessionId} with ${session.cartItems.length} items`,
      'CartTryonProcessor'
    );

    const results: Array<{ success: boolean; resultUrl?: string; error?: string }> = [];

    // Process items sequentially to avoid overwhelming the system
    for (let i = 0; i < session.cartItems.length; i++) {
      const item = session.cartItems[i];
      
      const result = await processCartItem(session, item, i);
      results.push(result);

      // Update progress
      const progress = Math.round(((i + 1) / session.cartItems.length) * 100);
      await cartTryonService.updateCartTryonSession(
        sessionId,
        session.organizationId,
        { progress }
      );

      // Small delay between items to prevent rate limiting
      if (i < session.cartItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Check if all items succeeded
    const allSucceeded = results.every(r => r.success);
    const anySucceeded = results.some(r => r.success);

    if (allSucceeded) {
      await cartTryonService.updateCartTryonSession(
        sessionId,
        session.organizationId,
        {
          status: 'completed',
          progress: 100,
          completedAt: new Date()
        }
      );

      // Trigger webhook
      await webhookService.triggerTryonCompletedWebhook(
        session.organizationId,
        sessionId,
        {
          cartId: session.cartId,
          itemCount: session.cartItems.length,
          creditsUsed: session.creditsUsed
        }
      );

      logger.info(
        `Cart try-on session ${sessionId} completed successfully`,
        'CartTryonProcessor'
      );
    } else if (anySucceeded) {
      await cartTryonService.updateCartTryonSession(
        sessionId,
        session.organizationId,
        {
          status: 'partial',
          progress: 100,
          completedAt: new Date()
        }
      );

      logger.warn(
        `Cart try-on session ${sessionId} partially completed`,
        'CartTryonProcessor'
      );
    } else {
      await cartTryonService.updateCartTryonSession(
        sessionId,
        session.organizationId,
        {
          status: 'failed',
          progress: 100,
          completedAt: new Date()
        }
      );

      // Trigger failure webhook
      await webhookService.triggerTryonFailedWebhook(
        session.organizationId,
        sessionId,
        'All items failed to process'
      );

      logger.error(
        `Cart try-on session ${sessionId} failed`,
        'CartTryonProcessor'
      );
    }

    // Webhook will be triggered by WebSocket handler or separate webhook service
  } catch (error) {
    logger.error(
      `Error processing cart try-on session ${sessionId}: ${error}`,
      'CartTryonProcessor'
    );

    // Update session status to failed
    try {
      const session = await storage.getCartTryonSession(sessionId);
      if (session) {
        await cartTryonService.updateCartTryonSession(
          sessionId,
          session.organizationId,
          {
            status: 'failed',
            completedAt: new Date()
          }
        );
      }
    } catch (updateError) {
      logger.error(`Failed to update session status: ${updateError}`, 'CartTryonProcessor');
    }

    throw error;
  }
}

/**
 * Get processing status for a cart try-on session
 */
export async function getCartTryonStatus(
  sessionId: string,
  organizationId: string
): Promise<{
  session: CartTryonSession;
  items: Array<{
    productId: string;
    name: string;
    status: string;
    resultUrl?: string;
  }>;
}> {
  try {
    const session = await cartTryonService.getCartTryonSession(sessionId, organizationId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Get individual item results (would need to query tryon_results table)
    // For now, return session-level status
    const items = session.cartItems.map((item, index) => ({
      productId: item.productId,
      name: item.name,
      status: session.status,
      resultUrl: undefined // Would fetch from results table
    }));

    return {
      session,
      items
    };
  } catch (error) {
    logger.error(`Error getting cart try-on status: ${error}`, 'CartTryonProcessor');
    throw error;
  }
}

export const cartTryonProcessor = {
  processCartTryonSession,
  getCartTryonStatus
};

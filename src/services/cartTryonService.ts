import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import { organizationService } from './organizationService';
import type { CartTryonSession, InsertCartTryonSession } from '@shared/schema';
import type { CartItem } from '../types/enterprise';

/**
 * Service for managing cart try-on sessions
 * Handles atomic credit deduction and session lifecycle
 */

interface CreateCartTryonData {
  organizationId: string;
  externalCustomerId: string;
  cartId: string;
  cartItems: CartItem[];
  customerPhotoUrl: string;
  customerPhotoS3Key: string;
  renderQuality?: 'sd' | 'hd' | '4k';
  backgroundScene?: string;
  webhookUrl?: string;
}

/**
 * Calculate credits needed for a try-on session
 * Based on number of items, render quality, etc.
 */
function calculateCreditsNeeded(
  itemCount: number,
  renderQuality: 'sd' | 'hd' | '4k'
): number {
  // Base cost per item
  let costPerItem = 10;

  // Quality multiplier
  const qualityMultiplier = {
    'sd': 1,
    'hd': 1.5,
    '4k': 2
  }[renderQuality];

  // Volume discount for multiple items
  const volumeDiscount = itemCount > 5 ? 0.8 : itemCount > 3 ? 0.9 : 1;

  return Math.ceil(itemCount * costPerItem * qualityMultiplier * volumeDiscount);
}

/**
 * Create a new cart try-on session
 * Deducts credits atomically before creating session
 */
export async function createCartTryonSession(
  data: CreateCartTryonData
): Promise<CartTryonSession> {
  try {
    // Validate cart items
    if (!data.cartItems || data.cartItems.length === 0) {
      throw new Error('Cart must contain at least one item');
    }

    if (data.cartItems.length > 20) {
      throw new Error('Maximum 20 items per cart try-on session');
    }

    // Calculate credits needed
    const renderQuality = data.renderQuality || 'hd';
    const creditsNeeded = calculateCreditsNeeded(data.cartItems.length, renderQuality);

    logger.info(
      `Creating cart try-on session: ${data.cartItems.length} items, ${creditsNeeded} credits`,
      'CartTryonService'
    );

    // Atomically deduct credits
    try {
      await organizationService.deductCredits(data.organizationId, creditsNeeded);
    } catch (error) {
      if ((error as Error).message === 'Insufficient credits') {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      throw error;
    }

    // Verify customer exists
    const customer = await storage.getExternalCustomer(
      data.organizationId,
      data.externalCustomerId
    );

    if (!customer) {
      // Refund credits if customer not found
      await organizationService.addCredits(
        data.organizationId,
        creditsNeeded
      );
      throw new Error('Customer not found');
    }

    // Create session
    const sessionData: InsertCartTryonSession = {
      organizationId: data.organizationId,
      externalCustomerId: customer.id,
      cartId: data.cartId,
      cartItems: data.cartItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId || '',
        name: item.productName,
        imageUrl: item.productImageUrl,
        category: item.category || 'unknown',
        quantity: 1,
        price: 0,
        currency: 'USD'
      })),
      customerPhotoUrl: data.customerPhotoUrl,
      customerPhotoS3Key: data.customerPhotoS3Key,
      renderQuality,
      backgroundScene: data.backgroundScene || 'studio',
      status: 'queued',
      progress: 0,
      webhookUrl: data.webhookUrl,
      webhookDelivered: false,
      creditsUsed: creditsNeeded
    };

    const session = await storage.createCartTryonSession(sessionData);

    logger.info(
      `Created cart try-on session ${session.id} for org ${data.organizationId}`,
      'CartTryonService'
    );

    return session;
  } catch (error) {
    logger.error(`Error creating cart try-on session: ${error}`, 'CartTryonService');
    throw error;
  }
}

/**
 * Get cart try-on session by ID
 */
export async function getCartTryonSession(
  sessionId: string,
  organizationId: string
): Promise<CartTryonSession | null> {
  try {
    const session = await storage.getCartTryonSession(sessionId);

    if (!session) {
      return null;
    }

    // Verify session belongs to organization
    if (session.organizationId !== organizationId) {
      throw new Error('Session does not belong to organization');
    }

    return session;
  } catch (error) {
    logger.error(`Error getting cart try-on session: ${error}`, 'CartTryonService');
    throw error;
  }
}

/**
 * List cart try-on sessions for organization
 */
export async function listCartTryonSessions(
  organizationId: string,
  filters?: {
    status?: string;
    cartId?: string;
    externalCustomerId?: string;
  },
  pagination?: {
    limit?: number;
    offset?: number;
  }
): Promise<CartTryonSession[]> {
  try {
    const sessions = await storage.listCartTryonSessions(
      organizationId,
      filters,
      pagination
    );

    return sessions;
  } catch (error) {
    logger.error(`Error listing cart try-on sessions: ${error}`, 'CartTryonService');
    throw error;
  }
}

/**
 * Update cart try-on session status and progress
 */
export async function updateCartTryonSession(
  sessionId: string,
  organizationId: string,
  updates: {
    status?: string;
    progress?: number;
    renderedImageUrl?: string;
    completedAt?: Date;
  }
): Promise<CartTryonSession> {
  try {
    const session = await getCartTryonSession(sessionId, organizationId);

    if (!session) {
      throw new Error('Session not found');
    }

    const updated = await storage.updateCartTryonSession(sessionId, updates);

    logger.info(
      `Updated cart try-on session ${sessionId}: status=${updates.status}, progress=${updates.progress}`,
      'CartTryonService'
    );

    return updated;
  } catch (error) {
    logger.error(`Error updating cart try-on session: ${error}`, 'CartTryonService');
    throw error;
  }
}

/**
 * Cancel a cart try-on session and refund credits
 * Only allowed for sessions in queued or processing state
 */
export async function cancelCartTryonSession(
  sessionId: string,
  organizationId: string
): Promise<CartTryonSession> {
  try {
    const session = await getCartTryonSession(sessionId, organizationId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (!['queued', 'processing'].includes(session.status)) {
      throw new Error('Cannot cancel completed or failed session');
    }

    // Refund credits
    if (session.creditsUsed > 0) {
      await organizationService.addCredits(
        organizationId,
        session.creditsUsed
      );
    }

    // Update session status
    const updated = await storage.updateCartTryonSession(sessionId, {
      status: 'cancelled',
      completedAt: new Date()
    });

    logger.info(
      `Cancelled cart try-on session ${sessionId}, refunded ${session.creditsUsed} credits`,
      'CartTryonService'
    );

    return updated;
  } catch (error) {
    logger.error(`Error cancelling cart try-on session: ${error}`, 'CartTryonService');
    throw error;
  }
}

export const cartTryonService = {
  createCartTryonSession,
  getCartTryonSession,
  listCartTryonSessions,
  updateCartTryonSession,
  cancelCartTryonSession,
  calculateCreditsNeeded
};

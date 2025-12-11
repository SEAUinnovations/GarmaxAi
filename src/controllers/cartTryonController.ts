import { Request, Response } from 'express';
import { cartTryonService } from '../services/cartTryonService';
import { cartTryonProcessor } from '../services/cartTryonProcessorService';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest, CreateCartTryonRequest } from '../types/enterprise';

/**
 * Create a new cart try-on session
 * POST /api/v1/cart/tryon
 */
export async function createCartTryon(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const data: CreateCartTryonRequest = req.body;

    // Validate required fields
    if (!data.customerId || !data.customerPhotoUrl || !data.cartItems) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'customerId, customerPhotoUrl, and cartItems are required'
      });
      return;
    }

    if (!Array.isArray(data.cartItems) || data.cartItems.length === 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'cartItems must be a non-empty array'
      });
      return;
    }

    // Validate render quality
    if (data.quality && !['sd', 'hd', '4k'].includes(data.quality)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'quality must be sd, hd, or 4k'
      });
      return;
    }

    // Generate cartId from metadata or create new one
    const cartId = (data.metadata?.cartId as string) || `cart-${Date.now()}`;

    // Create session (will deduct credits atomically)
    try {
      const session = await cartTryonService.createCartTryonSession({
        organizationId,
        externalCustomerId: data.customerId,
        cartId,
        cartItems: data.cartItems,
        customerPhotoUrl: data.customerPhotoUrl,
        customerPhotoS3Key: `enterprise/org-${organizationId}/photos/${data.customerId}`,
        renderQuality: data.quality,
        backgroundScene: (data.metadata?.backgroundScene as string) || 'studio',
        webhookUrl: data.webhookUrl
      });

      // Trigger async processing
      // In production, this would be handled by a queue/EventBridge
      cartTryonProcessor.processCartTryonSession(session.id).catch(error => {
        logger.error(`Background processing failed for session ${session.id}: ${error}`, 'CartTryonController');
      });

      res.status(201).json({
        session: {
          id: session.id,
          cartId: session.cartId,
          status: session.status,
          progress: session.progress,
          itemCount: session.cartItems.length,
          creditsUsed: session.creditsUsed,
          estimatedCompletionTime: `${session.cartItems.length * 30} seconds`,
          createdAt: session.createdAt
        }
      });
    } catch (error) {
      if ((error as Error).message === 'INSUFFICIENT_CREDITS') {
        res.status(402).json({
          error: 'INSUFFICIENT_CREDITS',
          message: 'Organization does not have enough credits for this try-on session',
          creditsNeeded: cartTryonService.calculateCreditsNeeded(
            data.cartItems.length,
            data.quality || 'hd'
          )
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Error creating cart try-on: ${error}`, 'CartTryonController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create cart try-on session'
    });
  }
}

/**
 * Get cart try-on session status
 * GET /api/v1/cart/tryon/:sessionId
 */
export async function getCartTryonSession(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { sessionId } = req.params;

    const result = await cartTryonProcessor.getCartTryonStatus(sessionId, organizationId);

    if (!result.session) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Cart try-on session not found'
      });
      return;
    }

    res.json({
      session: {
        id: result.session.id,
        cartId: result.session.cartId,
        status: result.session.status,
        progress: result.session.progress,
        creditsUsed: result.session.creditsUsed,
        itemCount: result.session.cartItems.length,
        renderedImageUrl: result.session.renderedImageUrl,
        createdAt: result.session.createdAt,
        completedAt: result.session.completedAt
      },
      items: result.items
    });
  } catch (error) {
    if ((error as Error).message === 'Session does not belong to organization') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Session does not belong to your organization'
      });
      return;
    }

    logger.error(`Error getting cart try-on session: ${error}`, 'CartTryonController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get cart try-on session'
    });
  }
}

/**
 * List cart try-on sessions
 * GET /api/v1/cart/tryon
 */
export async function listCartTryonSessions(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { status, cartId, externalCustomerId, limit = '50', offset = '0' } = req.query;

    const sessions = await cartTryonService.listCartTryonSessions(
      organizationId,
      {
        status: status as string,
        cartId: cartId as string,
        externalCustomerId: externalCustomerId as string
      },
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    res.json({
      sessions: sessions.map(session => ({
        id: session.id,
        cartId: session.cartId,
        status: session.status,
        progress: session.progress,
        itemCount: session.cartItems.length,
        creditsUsed: session.creditsUsed,
        createdAt: session.createdAt,
        completedAt: session.completedAt
      })),
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    logger.error(`Error listing cart try-on sessions: ${error}`, 'CartTryonController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list cart try-on sessions'
    });
  }
}

/**
 * Cancel cart try-on session
 * DELETE /api/v1/cart/tryon/:sessionId
 */
export async function cancelCartTryonSession(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { sessionId } = req.params;

    const session = await cartTryonService.cancelCartTryonSession(sessionId, organizationId);

    res.json({
      message: 'Cart try-on session cancelled and credits refunded',
      session: {
        id: session.id,
        status: session.status,
        creditsRefunded: session.creditsUsed
      }
    });
  } catch (error) {
    if ((error as Error).message === 'Session not found') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Cart try-on session not found'
      });
      return;
    }

    if ((error as Error).message === 'Cannot cancel completed or failed session') {
      res.status(400).json({
        error: 'INVALID_STATE',
        message: 'Cannot cancel completed or failed session'
      });
      return;
    }

    logger.error(`Error cancelling cart try-on session: ${error}`, 'CartTryonController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to cancel cart try-on session'
    });
  }
}

import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter, customRateLimiter } from '../middleware/rateLimiter';
import { scopeValidator } from '../middleware/scopeValidator';
import { usageLogger } from '../middleware/usageLogger';
import {
  createCartTryon,
  getCartTryonSession,
  listCartTryonSessions,
  cancelCartTryonSession
} from '../controllers/cartTryonController';

const router = Router();

// All cart try-on routes require API key authentication
router.use(apiKeyAuth);
router.use(usageLogger);

/**
 * @route POST /api/v1/cart/tryon
 * @desc Create a new cart try-on session
 * @scope tryon:create
 * @access API Key with tryon:create scope
 */
router.post(
  '/',
  customRateLimiter(10), // 10 try-on requests per minute
  scopeValidator(['tryon:create']),
  createCartTryon
);

/**
 * @route GET /api/v1/cart/tryon
 * @desc List cart try-on sessions
 * @scope tryon:read
 * @access API Key with tryon:read scope
 */
router.get(
  '/',
  rateLimiter,
  scopeValidator(['tryon:read']),
  listCartTryonSessions
);

/**
 * @route GET /api/v1/cart/tryon/:sessionId
 * @desc Get cart try-on session status
 * @scope tryon:read
 * @access API Key with tryon:read scope
 */
router.get(
  '/:sessionId',
  rateLimiter,
  scopeValidator(['tryon:read']),
  getCartTryonSession
);

/**
 * @route DELETE /api/v1/cart/tryon/:sessionId
 * @desc Cancel cart try-on session and refund credits
 * @scope tryon:create
 * @access API Key with tryon:create scope
 */
router.delete(
  '/:sessionId',
  rateLimiter,
  scopeValidator(['tryon:create']),
  cancelCartTryonSession
);

export default router;

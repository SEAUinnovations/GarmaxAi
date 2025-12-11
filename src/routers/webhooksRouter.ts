import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook
} from '../controllers/webhookController';

// Create router with mergeParams to access parent route params (orgId)
const router = Router({ mergeParams: true });

// All webhook routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/organizations/:orgId/webhooks
 * @desc Create a new webhook configuration
 * @access Private (webhooks:manage permission required)
 */
router.post('/', createWebhook);

/**
 * @route GET /api/organizations/:orgId/webhooks
 * @desc List organization's webhooks
 * @access Private (organization members)
 */
router.get('/', listWebhooks);

/**
 * @route GET /api/organizations/:orgId/webhooks/:webhookId
 * @desc Get webhook details
 * @access Private (organization members)
 */
router.get('/:webhookId', getWebhook);

/**
 * @route PUT /api/organizations/:orgId/webhooks/:webhookId
 * @desc Update webhook configuration
 * @access Private (webhooks:manage permission required)
 */
router.put('/:webhookId', updateWebhook);

/**
 * @route DELETE /api/organizations/:orgId/webhooks/:webhookId
 * @desc Delete webhook
 * @access Private (webhooks:manage permission required)
 */
router.delete('/:webhookId', deleteWebhook);

/**
 * @route POST /api/organizations/:orgId/webhooks/:webhookId/test
 * @desc Test webhook endpoint
 * @access Private (organization members)
 */
router.post('/:webhookId/test', testWebhook);

export default router;

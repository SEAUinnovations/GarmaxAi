import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createApiKey,
  listApiKeys,
  getApiKey,
  revokeApiKey,
  getApiKeyStats
} from '../controllers/apiKeyController';

// Create router with mergeParams to access parent route params (orgId)
const router = Router({ mergeParams: true });

// All API key routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/organizations/:orgId/api-keys
 * @desc Create a new API key for organization
 * @access Private (apikeys:create permission required)
 */
router.post('/', createApiKey);

/**
 * @route GET /api/organizations/:orgId/api-keys
 * @desc List organization's API keys
 * @access Private (organization members)
 */
router.get('/', listApiKeys);

/**
 * @route GET /api/organizations/:orgId/api-keys/:keyId
 * @desc Get API key details
 * @access Private (organization members)
 */
router.get('/:keyId', getApiKey);

/**
 * @route DELETE /api/organizations/:orgId/api-keys/:keyId
 * @desc Revoke an API key
 * @access Private (apikeys:delete permission required)
 */
router.delete('/:keyId', revokeApiKey);

/**
 * @route GET /api/organizations/:orgId/api-keys/:keyId/stats
 * @desc Get API key usage statistics
 * @access Private (organization members)
 */
router.get('/:keyId/stats', getApiKeyStats);

export default router;

import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import { scopeValidator } from '../middleware/scopeValidator';
import { usageLogger } from '../middleware/usageLogger';
import {
  upsertCustomer,
  getCustomer,
  listCustomers,
  deleteCustomer
} from '../controllers/externalCustomerController';

const router = Router();

// All customer routes require API key authentication
router.use(apiKeyAuth);
router.use(usageLogger);

/**
 * @route POST /api/v1/customers
 * @desc Create or update an external customer (upsert)
 * @scope customers:create
 * @access API Key with customers:create scope
 */
router.post('/', rateLimiter, scopeValidator(['customers:create']), upsertCustomer);

/**
 * @route GET /api/v1/customers
 * @desc List external customers
 * @scope customers:read
 * @access API Key with customers:read scope
 */
router.get('/', rateLimiter, scopeValidator(['customers:read']), listCustomers);

/**
 * @route GET /api/v1/customers/:externalCustomerId
 * @desc Get external customer by ID
 * @scope customers:read
 * @access API Key with customers:read scope
 */
router.get('/:externalCustomerId', rateLimiter, scopeValidator(['customers:read']), getCustomer);

/**
 * @route DELETE /api/v1/customers/:externalCustomerId
 * @desc Delete external customer
 * @scope customers:create
 * @access API Key with customers:create scope
 */
router.delete('/:externalCustomerId', rateLimiter, scopeValidator(['customers:create']), deleteCustomer);

export default router;

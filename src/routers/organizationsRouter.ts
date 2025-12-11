import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
  addCredits
} from '../controllers/organizationController';

const router = Router();

// All organization routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/organizations
 * @desc Create a new organization
 * @access Private
 */
router.post('/', createOrganization);

/**
 * @route GET /api/organizations
 * @desc List user's organizations
 * @access Private
 */
router.get('/', listOrganizations);

/**
 * @route GET /api/organizations/:orgId
 * @desc Get organization details
 * @access Private (members only)
 */
router.get('/:orgId', getOrganization);

/**
 * @route PUT /api/organizations/:orgId
 * @desc Update organization details
 * @access Private (admins only)
 */
router.put('/:orgId', updateOrganization);

/**
 * @route POST /api/organizations/:orgId/credits
 * @desc Add credits to organization
 * @access Private (billing permission required)
 */
router.post('/:orgId/credits', addCredits);

export default router;

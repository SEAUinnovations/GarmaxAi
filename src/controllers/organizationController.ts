import { Request, Response } from 'express';
import { organizationService } from '../services/organizationService';
import { logger } from '../utils/winston-logger';
import type { EnterpriseAuthRequest, CreateOrganizationRequest } from '../types/enterprise';

/**
 * Create a new organization
 * POST /api/organizations
 */
export async function createOrganization(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;
    const data: CreateOrganizationRequest = req.body;

    // Validate required fields
    if (!data.name || !data.slug) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and slug are required'
      });
      return;
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      res.status(400).json({
        error: 'INVALID_SLUG',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens'
      });
      return;
    }

    const organization = await organizationService.createOrganization(userId, data);

    res.status(201).json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionTier: organization.subscriptionTier,
        credits: organization.credits,
        apiRateLimit: organization.apiRateLimit,
        status: organization.status,
        createdAt: organization.createdAt
      }
    });
  } catch (error: any) {
    if (error.message === 'SLUG_ALREADY_EXISTS') {
      res.status(409).json({
        error: 'SLUG_ALREADY_EXISTS',
        message: 'Organization slug is already taken'
      });
      return;
    }

    logger.error(`Error creating organization: ${error}`, 'OrganizationController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create organization'
    });
  }
}

/**
 * Get organization by ID
 * GET /api/organizations/:orgId
 */
export async function getOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    const organization = await organizationService.getOrganization(orgId);

    if (!organization) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Organization not found'
      });
      return;
    }

    // Check if user is a member
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    // Get members list
    const members = await organizationService.listMembers(orgId);

    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionTier: organization.subscriptionTier,
        credits: organization.credits,
        apiRateLimit: organization.apiRateLimit,
        status: organization.status,
        billingEmail: organization.billingEmail,
        companyWebsite: organization.companyWebsite,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      },
      members: members.map(m => ({
        userId: m.userId,
        role: m.role,
        permissions: m.permissions,
        joinedAt: m.joinedAt
      }))
    });
  } catch (error) {
    logger.error(`Error getting organization: ${error}`, 'OrganizationController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get organization'
    });
  }
}

/**
 * List user's organizations
 * GET /api/organizations
 */
export async function listOrganizations(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    const organizations = await organizationService.getUserOrganizations(userId);

    res.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscriptionTier: org.subscriptionTier,
        credits: org.credits,
        status: org.status,
        createdAt: org.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error listing organizations: ${error}`, 'OrganizationController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list organizations'
    });
  }
}

/**
 * Update organization
 * PUT /api/organizations/:orgId
 */
export async function updateOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;
    const data = req.body;

    // Check permission (owner or admin can update)
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'org:manage');
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to update this organization'
      });
      return;
    }

    const organization = await organizationService.updateOrganization(orgId, data);

    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        billingEmail: organization.billingEmail,
        companyWebsite: organization.companyWebsite,
        updatedAt: organization.updatedAt
      }
    });
  } catch (error: any) {
    if (error.message === 'SLUG_ALREADY_EXISTS') {
      res.status(409).json({
        error: 'SLUG_ALREADY_EXISTS',
        message: 'Organization slug is already taken'
      });
      return;
    }

    logger.error(`Error updating organization: ${error}`, 'OrganizationController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update organization'
    });
  }
}

/**
 * Add credits to organization (admin only)
 * POST /api/organizations/:orgId/credits
 */
export async function addCredits(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const { amount } = req.body;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    if (!amount || amount <= 0) {
      res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number'
      });
      return;
    }

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'org:billing');
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to manage billing'
      });
      return;
    }

    const organization = await organizationService.addCredits(orgId, amount);

    res.json({
      organization: {
        id: organization.id,
        credits: organization.credits
      },
      added: amount
    });
  } catch (error) {
    logger.error(`Error adding credits: ${error}`, 'OrganizationController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to add credits'
    });
  }
}

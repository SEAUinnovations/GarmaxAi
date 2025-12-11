import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import type { 
  Organization,
  InsertOrganization 
} from '@shared/schema';
import type { 
  CreateOrganizationRequest 
} from '../types/enterprise';

/**
 * Service for organization management operations
 */
export class OrganizationService {
  /**
   * Create a new organization
   */
  async createOrganization(
    ownerId: string, 
    data: CreateOrganizationRequest
  ): Promise<Organization> {
    try {
      // Check if slug is already taken
      const existing = await storage.getOrganizationBySlug(data.slug);
      if (existing) {
        throw new Error('SLUG_ALREADY_EXISTS');
      }

      // Create organization
      const organization = await storage.createOrganization({
        name: data.name,
        slug: data.slug,
        ownerId,
        subscriptionTier: 'free',
        credits: 0,
        apiRateLimit: 60, // Default 60 req/min
        status: 'active',
        billingEmail: data.billingEmail,
        companyWebsite: data.companyWebsite,
      });

      // Add owner as member
      await storage.addOrganizationMember({
        organizationId: organization.id,
        userId: ownerId,
        role: 'owner',
        permissions: ['all'], // Owner has all permissions
      });

      logger.info(`Organization created: ${organization.slug} by ${ownerId}`, 'OrganizationService');
      return organization;
    } catch (error) {
      logger.error(`Error creating organization: ${error}`, 'OrganizationService');
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | undefined> {
    return storage.getOrganization(orgId);
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    return storage.getOrganizationBySlug(slug);
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    orgId: string, 
    data: Partial<Organization>
  ): Promise<Organization> {
    try {
      // If slug is being updated, check availability
      if (data.slug) {
        const existing = await storage.getOrganizationBySlug(data.slug);
        if (existing && existing.id !== orgId) {
          throw new Error('SLUG_ALREADY_EXISTS');
        }
      }

      return await storage.updateOrganization(orgId, data);
    } catch (error) {
      logger.error(`Error updating organization ${orgId}: ${error}`, 'OrganizationService');
      throw error;
    }
  }

  /**
   * Get all organizations for a user
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    return storage.getUserOrganizations(userId);
  }

  /**
   * Add credits to organization
   */
  async addCredits(orgId: string, amount: number): Promise<Organization> {
    try {
      if (amount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }

      const organization = await storage.addOrganizationCredits(orgId, amount);
      logger.info(`Added ${amount} credits to organization ${orgId}`, 'OrganizationService');
      return organization;
    } catch (error) {
      logger.error(`Error adding credits to organization ${orgId}: ${error}`, 'OrganizationService');
      throw error;
    }
  }

  /**
   * Deduct credits from organization (atomic operation)
   * Throws INSUFFICIENT_CREDITS if organization doesn't have enough credits
   */
  async deductCredits(orgId: string, amount: number): Promise<Organization> {
    try {
      if (amount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }

      return await storage.deductOrganizationCredits(orgId, amount);
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
        logger.warn(`Insufficient credits for organization ${orgId}, requested ${amount}`, 'OrganizationService');
      } else {
        logger.error(`Error deducting credits from organization ${orgId}: ${error}`, 'OrganizationService');
      }
      throw error;
    }
  }

  /**
   * Check if organization has sufficient credits
   */
  async hasCredits(orgId: string, required: number): Promise<boolean> {
    try {
      const organization = await storage.getOrganization(orgId);
      return organization ? organization.credits >= required : false;
    } catch (error) {
      logger.error(`Error checking credits for organization ${orgId}: ${error}`, 'OrganizationService');
      return false;
    }
  }

  /**
   * Get organization member
   */
  async getOrganizationMember(orgId: string, userId: string) {
    return storage.getOrganizationMember(orgId, userId);
  }

  /**
   * List all members of an organization
   */
  async listMembers(orgId: string) {
    return storage.listOrganizationMembers(orgId);
  }

  /**
   * Check if user has permission in organization
   */
  async hasPermission(
    orgId: string, 
    userId: string, 
    permission: string
  ): Promise<boolean> {
    try {
      const member = await storage.getOrganizationMember(orgId, userId);
      if (!member) return false;

      // Owner and admin have all permissions
      if (member.role === 'owner' || member.role === 'admin') return true;

      // Check specific permission
      const permissions = member.permissions as string[];
      return permissions.includes(permission) || permissions.includes('all');
    } catch (error) {
      logger.error(`Error checking permission: ${error}`, 'OrganizationService');
      return false;
    }
  }
}

export const organizationService = new OrganizationService();

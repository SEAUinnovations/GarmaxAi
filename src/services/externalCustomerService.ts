import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import type { ExternalCustomer, InsertExternalCustomer } from '@shared/schema';

/**
 * Service for managing external customers (partners' end users)
 */

interface UpsertCustomerData {
  externalCustomerId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, any>;
}

/**
 * Create or update an external customer
 * Uses externalCustomerId + organizationId as unique identifier
 */
export async function upsertExternalCustomer(
  organizationId: string,
  data: UpsertCustomerData
): Promise<ExternalCustomer> {
  try {
    // Check if customer already exists
    const existing = await storage.getExternalCustomer(
      organizationId,
      data.externalCustomerId
    );

    if (existing) {
      // Update existing customer
      const updated = await storage.updateExternalCustomer(existing.id, {
        email: data.email ?? existing.email,
        firstName: data.firstName ?? existing.firstName,
        lastName: data.lastName ?? existing.lastName,
        metadata: data.metadata 
          ? { ...existing.metadata, ...data.metadata }
          : existing.metadata
      });

      logger.info(
        `Updated external customer ${data.externalCustomerId} for org ${organizationId}`,
        'ExternalCustomerService'
      );

      return updated;
    } else {
      // Create new customer
      const newCustomer: InsertExternalCustomer = {
        organizationId,
        externalCustomerId: data.externalCustomerId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        metadata: data.metadata || {}
      };

      const created = await storage.createExternalCustomer(newCustomer);

      logger.info(
        `Created external customer ${data.externalCustomerId} for org ${organizationId}`,
        'ExternalCustomerService'
      );

      return created;
    }
  } catch (error) {
    logger.error(
      `Error upserting external customer: ${error}`,
      'ExternalCustomerService'
    );
    throw error;
  }
}

/**
 * Get external customer by organization and external ID
 */
export async function getExternalCustomer(
  organizationId: string,
  externalCustomerId: string
): Promise<ExternalCustomer | null> {
  try {
    return await storage.getExternalCustomer(organizationId, externalCustomerId);
  } catch (error) {
    logger.error(
      `Error getting external customer: ${error}`,
      'ExternalCustomerService'
    );
    throw error;
  }
}

/**
 * List external customers for an organization
 */
export async function listExternalCustomers(
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ExternalCustomer[]> {
  try {
    return await storage.listExternalCustomers(organizationId, limit, offset);
  } catch (error) {
    logger.error(
      `Error listing external customers: ${error}`,
      'ExternalCustomerService'
    );
    throw error;
  }
}

/**
 * Delete external customer
 */
export async function deleteExternalCustomer(
  organizationId: string,
  externalCustomerId: string
): Promise<void> {
  try {
    const customer = await storage.getExternalCustomer(
      organizationId,
      externalCustomerId
    );

    if (!customer) {
      throw new Error('Customer not found');
    }

    await storage.deleteExternalCustomer(customer.id);

    logger.info(
      `Deleted external customer ${externalCustomerId} for org ${organizationId}`,
      'ExternalCustomerService'
    );
  } catch (error) {
    logger.error(
      `Error deleting external customer: ${error}`,
      'ExternalCustomerService'
    );
    throw error;
  }
}

export const externalCustomerService = {
  upsertExternalCustomer,
  getExternalCustomer,
  listExternalCustomers,
  deleteExternalCustomer
};

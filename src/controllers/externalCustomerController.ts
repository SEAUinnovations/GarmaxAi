import { Request, Response } from 'express';
import { externalCustomerService } from '../services/externalCustomerService';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest } from '../types/enterprise';

/**
 * Create or update an external customer (upsert)
 * POST /api/v1/customers
 */
export async function upsertCustomer(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const data = req.body;

    // Validate required fields
    if (!data.externalCustomerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalCustomerId is required'
      });
      return;
    }

    const customer = await externalCustomerService.upsertExternalCustomer(
      organizationId,
      {
        externalCustomerId: data.externalCustomerId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        metadata: data.metadata
      }
    );

    res.status(200).json({
      customer: {
        id: customer.id,
        externalCustomerId: customer.externalCustomerId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error upserting customer: ${error}`, 'ExternalCustomerController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create or update customer'
    });
  }
}

/**
 * Get external customer by ID
 * GET /api/v1/customers/:externalCustomerId
 */
export async function getCustomer(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { externalCustomerId } = req.params;

    const customer = await externalCustomerService.getExternalCustomer(
      organizationId,
      externalCustomerId
    );

    if (!customer) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Customer not found'
      });
      return;
    }

    res.json({
      customer: {
        id: customer.id,
        externalCustomerId: customer.externalCustomerId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error getting customer: ${error}`, 'ExternalCustomerController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get customer'
    });
  }
}

/**
 * List external customers
 * GET /api/v1/customers
 */
export async function listCustomers(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { limit = '50', offset = '0' } = req.query;

    const customers = await externalCustomerService.listExternalCustomers(
      organizationId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      customers: customers.map(customer => ({
        id: customer.id,
        externalCustomerId: customer.externalCustomerId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      })),
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    logger.error(`Error listing customers: ${error}`, 'ExternalCustomerController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list customers'
    });
  }
}

/**
 * Delete external customer
 * DELETE /api/v1/customers/:externalCustomerId
 */
export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { externalCustomerId } = req.params;

    await externalCustomerService.deleteExternalCustomer(
      organizationId,
      externalCustomerId
    );

    res.json({
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    if ((error as Error).message === 'Customer not found') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Customer not found'
      });
      return;
    }

    logger.error(`Error deleting customer: ${error}`, 'ExternalCustomerController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete customer'
    });
  }
}

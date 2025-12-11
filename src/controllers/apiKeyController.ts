import { Request, Response } from 'express';
import { apiKeyService } from '../services/apiKeyService';
import { organizationService } from '../services/organizationService';
import { logger } from '../utils/winston-logger';
import type { EnterpriseAuthRequest, CreateApiKeyRequest } from '../types/enterprise';

/**
 * Create a new API key
 * POST /api/organizations/:orgId/api-keys
 */
export async function createApiKey(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;
    const data: CreateApiKeyRequest = req.body;

    // Validate required fields
    if (!data.name || !data.environment || !data.scopes || data.scopes.length === 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name, environment, and scopes are required'
      });
      return;
    }

    // Validate environment
    if (!['live', 'test'].includes(data.environment)) {
      res.status(400).json({
        error: 'INVALID_ENVIRONMENT',
        message: 'Environment must be "live" or "test"'
      });
      return;
    }

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'apikeys:create');
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to create API keys'
      });
      return;
    }

    // Generate API key
    const { key, apiKey } = await apiKeyService.generateApiKey(orgId, userId, data);

    res.status(201).json({
      message: 'API key created successfully. Save this key securely - it will not be shown again.',
      key, // Full key shown only once
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.keyPrefix,
        environment: apiKey.environment,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        status: apiKey.status,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error creating API key: ${error}`, 'ApiKeyController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create API key'
    });
  }
}

/**
 * List organization's API keys
 * GET /api/organizations/:orgId/api-keys
 */
export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const apiKeys = await apiKeyService.listApiKeys(orgId);

    res.json({
      apiKeys: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        description: key.description,
        keyPrefix: key.keyPrefix, // Show prefix only, never full key
        environment: key.environment,
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        status: key.status,
        lastUsedAt: key.lastUsedAt,
        requestCount: key.requestCount,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error listing API keys: ${error}`, 'ApiKeyController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list API keys'
    });
  }
}

/**
 * Get API key details
 * GET /api/organizations/:orgId/api-keys/:keyId
 */
export async function getApiKey(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, keyId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const apiKey = await apiKeyService.getApiKey(keyId);

    if (!apiKey || apiKey.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API key not found'
      });
      return;
    }

    res.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.keyPrefix,
        environment: apiKey.environment,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        status: apiKey.status,
        lastUsedAt: apiKey.lastUsedAt,
        requestCount: apiKey.requestCount,
        expiresAt: apiKey.expiresAt,
        revokedAt: apiKey.revokedAt,
        revokedReason: apiKey.revokedReason,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error getting API key: ${error}`, 'ApiKeyController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get API key'
    });
  }
}

/**
 * Revoke an API key
 * DELETE /api/organizations/:orgId/api-keys/:keyId
 */
export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, keyId } = req.params;
    const { reason } = req.body;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'apikeys:delete');
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to revoke API keys'
      });
      return;
    }

    // Verify key belongs to organization
    const apiKey = await apiKeyService.getApiKey(keyId);
    if (!apiKey || apiKey.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API key not found'
      });
      return;
    }

    const revokedKey = await apiKeyService.revokeApiKey(
      keyId,
      userId,
      reason || 'Revoked by user'
    );

    res.json({
      message: 'API key revoked successfully',
      apiKey: {
        id: revokedKey.id,
        name: revokedKey.name,
        status: revokedKey.status,
        revokedAt: revokedKey.revokedAt,
        revokedReason: revokedKey.revokedReason
      }
    });
  } catch (error) {
    logger.error(`Error revoking API key: ${error}`, 'ApiKeyController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to revoke API key'
    });
  }
}

/**
 * Get API key usage statistics
 * GET /api/organizations/:orgId/api-keys/:keyId/stats
 */
export async function getApiKeyStats(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, keyId } = req.params;
    const { days = '7' } = req.query;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    // Verify key belongs to organization
    const apiKey = await apiKeyService.getApiKey(keyId);
    if (!apiKey || apiKey.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API key not found'
      });
      return;
    }

    const stats = await apiKeyService.getApiKeyStats(keyId, parseInt(days as string));

    res.json({
      stats,
      period: `Last ${days} days`
    });
  } catch (error) {
    logger.error(`Error getting API key stats: ${error}`, 'ApiKeyController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get API key stats'
    });
  }
}

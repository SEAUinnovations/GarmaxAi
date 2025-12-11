import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { verifyApiKey, isValidApiKeyFormat } from '../utils/apiKeyGenerator';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest } from '../types/enterprise';

/**
 * Middleware to authenticate API requests using API keys
 * Extracts key from Authorization header, verifies it, and attaches metadata to request
 * 
 * Expected header: Authorization: Bearer gxai_live_sk_xxx or gxai_test_sk_xxx
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Expected: Bearer gxai_xxx_sk_xxx'
      });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      res.status(401).json({
        error: 'INVALID_API_KEY',
        message: 'API key format is invalid'
      });
      return;
    }

    // Extract prefix for database lookup (first 12 chars)
    const keyPrefix = apiKey.substring(0, 12);

    // Find API key in database by prefix
    const storedKey = await storage.getApiKeyByPrefix(keyPrefix);
    
    if (!storedKey) {
      logger.warn(`API key not found: ${keyPrefix}`, 'apiKeyAuth');
      res.status(401).json({
        error: 'INVALID_API_KEY',
        message: 'API key not found'
      });
      return;
    }

    // Verify key status
    if (storedKey.status !== 'active') {
      logger.warn(`Inactive API key used: ${storedKey.id}, status: ${storedKey.status}`, 'apiKeyAuth');
      res.status(401).json({
        error: 'INVALID_API_KEY',
        message: `API key is ${storedKey.status}`
      });
      return;
    }

    // Check expiration
    if (storedKey.expiresAt && new Date(storedKey.expiresAt) < new Date()) {
      logger.warn(`Expired API key used: ${storedKey.id}`, 'apiKeyAuth');
      res.status(401).json({
        error: 'EXPIRED_API_KEY',
        message: 'API key has expired'
      });
      return;
    }

    // Verify key hash using bcrypt
    const isValid = await verifyApiKey(apiKey, storedKey.keyHash);
    
    if (!isValid) {
      logger.warn(`Invalid API key hash: ${keyPrefix}`, 'apiKeyAuth');
      res.status(401).json({
        error: 'INVALID_API_KEY',
        message: 'API key verification failed'
      });
      return;
    }

    // Get organization details
    const organization = await storage.getOrganization(storedKey.organizationId);
    
    if (!organization) {
      logger.error(`Organization not found for API key: ${storedKey.id}`, 'apiKeyAuth');
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Organization not found'
      });
      return;
    }

    // Check organization status
    if (organization.status !== 'active') {
      res.status(403).json({
        error: 'ORGANIZATION_SUSPENDED',
        message: `Organization is ${organization.status}`
      });
      return;
    }

    // Attach metadata to request for downstream middleware
    const apiKeyReq = req as ApiKeyRequest;
    apiKeyReq.organizationId = storedKey.organizationId;
    apiKeyReq.apiKeyId = storedKey.id;
    apiKeyReq.apiKeyScopes = storedKey.scopes as any[];
    apiKeyReq.apiKeyRateLimit = storedKey.rateLimit || organization.apiRateLimit;
    apiKeyReq.organization = organization;

    // Update last used timestamp (async, don't wait)
    storage.updateApiKey(storedKey.id, {
      lastUsedAt: new Date(),
      requestCount: storedKey.requestCount + 1
    }).catch(err => logger.error(`Failed to update API key usage: ${err}`, 'apiKeyAuth'));

    logger.info(`API request authenticated: org=${organization.slug}, key=${storedKey.name}`, 'apiKeyAuth');
    next();
  } catch (error) {
    logger.error(`API key authentication error: ${error}`, 'apiKeyAuth');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional middleware to allow both Cognito auth and API key auth
 * Tries Cognito first, falls back to API key
 */
export async function flexibleAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check if Cognito token exists
  if (req.headers.authorization?.startsWith('Bearer eyJ')) {
    // Looks like a JWT token - use Cognito auth
    const { authenticateToken } = await import('./auth');
    return authenticateToken(req, res, next);
  }
  
  // Otherwise try API key auth
  return apiKeyAuth(req, res, next);
}

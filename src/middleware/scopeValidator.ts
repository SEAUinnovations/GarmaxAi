import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest, ApiKeyScope } from '../types/enterprise';

/**
 * Map of endpoints to required scopes
 * Format: { method: { path: [scopes] } }
 */
const ENDPOINT_SCOPES: Record<string, Record<string, ApiKeyScope[]>> = {
  'POST': {
    '/api/v1/cart/tryon': ['tryon:create', 'all'],
    '/api/v1/photos/upload': ['photos:upload', 'all'],
    '/api/v1/customers': ['customers:create', 'all'],
  },
  'GET': {
    '/api/v1/cart/tryon': ['tryon:read', 'all'],
    '/api/v1/cart/tryon/:sessionId': ['tryon:read', 'all'],
    '/api/v1/customers/:customerId': ['customers:read', 'all'],
  },
};

/**
 * Middleware to validate API key has required scopes for the requested endpoint
 * Must be applied AFTER apiKeyAuth middleware
 * 
 * @param requiredScopes - Array of scopes, any one of which is sufficient
 */
export function scopeValidator(requiredScopes: ApiKeyScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKeyReq = req as ApiKeyRequest;

    // Ensure API key auth has run
    if (!apiKeyReq.apiKeyScopes) {
      logger.error('Scope validator called before API key auth', 'scopeValidator');
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authentication middleware not configured'
      });
      return;
    }

    const apiKeyScopes = apiKeyReq.apiKeyScopes;

    // Check if API key has 'all' scope (full access)
    if (apiKeyScopes.includes('all')) {
      next();
      return;
    }

    // Check if API key has any of the required scopes
    const hasRequiredScope = requiredScopes.some(required => 
      apiKeyScopes.includes(required)
    );

    if (!hasRequiredScope) {
      logger.warn(
        `Insufficient scopes: required=[${requiredScopes}], has=[${apiKeyScopes}], org=${apiKeyReq.organizationId}`,
        'scopeValidator'
      );
      
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'API key does not have required permissions',
        required: requiredScopes,
        available: apiKeyScopes
      });
      return;
    }

    next();
  };
}

/**
 * Automatic scope validator that determines required scopes based on endpoint
 * Uses ENDPOINT_SCOPES mapping
 */
export function autoScopeValidator(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKeyReq = req as ApiKeyRequest;

  if (!apiKeyReq.apiKeyScopes) {
    logger.error('Auto scope validator called before API key auth', 'scopeValidator');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication middleware not configured'
    });
    return;
  }

  const method = req.method;
  const path = req.route?.path || req.path;

  // Get required scopes for this endpoint
  const methodScopes = ENDPOINT_SCOPES[method];
  if (!methodScopes) {
    // No scopes defined for this method, allow
    next();
    return;
  }

  const requiredScopes = methodScopes[path];
  if (!requiredScopes) {
    // No scopes defined for this path, allow
    next();
    return;
  }

  // Check if API key has 'all' scope
  const apiKeyScopes = apiKeyReq.apiKeyScopes;
  if (apiKeyScopes.includes('all')) {
    next();
    return;
  }

  // Check if API key has any required scope
  const hasRequiredScope = requiredScopes.some(required => 
    apiKeyScopes.includes(required)
  );

  if (!hasRequiredScope) {
    logger.warn(
      `Auto scope check failed: ${method} ${path}, required=[${requiredScopes}], has=[${apiKeyScopes}]`,
      'scopeValidator'
    );
    
    res.status(403).json({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'API key does not have required permissions for this endpoint',
      required: requiredScopes,
      available: apiKeyScopes
    });
    return;
  }

  next();
}

/**
 * Helper function to check if API key has specific scope
 * Useful for conditional logic within controllers
 */
export function hasScope(req: Request, scope: ApiKeyScope): boolean {
  const apiKeyReq = req as ApiKeyRequest;
  if (!apiKeyReq.apiKeyScopes) return false;
  return apiKeyReq.apiKeyScopes.includes(scope) || apiKeyReq.apiKeyScopes.includes('all');
}

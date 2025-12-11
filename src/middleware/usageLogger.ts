import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest } from '../types/enterprise';

/**
 * Middleware to log API usage for analytics and billing
 * Logs every request to api_key_usage table
 * 
 * Must be applied AFTER apiKeyAuth middleware
 * Logs asynchronously to avoid blocking the response
 */
export function usageLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKeyReq = req as ApiKeyRequest;

  // Only log if this is an API key authenticated request
  if (!apiKeyReq.organizationId || !apiKeyReq.apiKeyId) {
    next();
    return;
  }

  const startTime = Date.now();

  // Capture response details
  const originalSend = res.send;
  let responseLogged = false;

  res.send = function (data: any): Response {
    if (!responseLogged) {
      responseLogged = true;
      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      // Log usage asynchronously (don't await)
      logUsage({
        apiKeyId: apiKeyReq.apiKeyId!,
        organizationId: apiKeyReq.organizationId!,
        endpoint: `${req.method} ${req.route?.path || req.path}`,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        processingTimeMs,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        creditsUsed: (res.locals.creditsUsed as number) || 0, // Set by controller if applicable
        requestBody: sanitizeRequestBody(req.body),
        responseBody: sanitizeResponseBody(data),
      }).catch(err => {
        logger.error(`Failed to log API usage: ${err}`, 'usageLogger');
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Helper function to log usage to database
 */
async function logUsage(data: {
  apiKeyId: string;
  organizationId: string;
  endpoint: string;
  method: string;
  path: string;
  statusCode: number;
  processingTimeMs: number;
  ipAddress: string;
  userAgent: string;
  creditsUsed: number;
  requestBody?: any;
  responseBody?: any;
}): Promise<void> {
  try {
    await storage.logApiKeyUsage({
      apiKeyId: data.apiKeyId,
      organizationId: data.organizationId,
      endpoint: data.endpoint,
      method: data.method,
      path: data.path,
      statusCode: data.statusCode,
      processingTimeMs: data.processingTimeMs,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      creditsUsed: data.creditsUsed,
      requestMetadata: data.requestBody ? JSON.stringify(data.requestBody) : null,
      responseMetadata: data.responseBody ? JSON.stringify(data.responseBody) : null,
    });

    logger.debug(
      `API usage logged: org=${data.organizationId}, endpoint=${data.endpoint}, status=${data.statusCode}, time=${data.processingTimeMs}ms`,
      'usageLogger'
    );
  } catch (error) {
    logger.error(`Error logging API usage: ${error}`, 'usageLogger');
    // Don't throw - logging should not break the request
  }
}

/**
 * Sanitize request body for logging
 * Remove sensitive fields and limit size
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return null;

  try {
    const sanitized = { ...body };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.token;
    
    // Limit size (truncate if > 1KB)
    const str = JSON.stringify(sanitized);
    if (str.length > 1024) {
      return { _truncated: true, _size: str.length };
    }
    
    return sanitized;
  } catch (error) {
    return { _error: 'Failed to sanitize request body' };
  }
}

/**
 * Sanitize response body for logging
 * Limit size and extract key metrics
 */
function sanitizeResponseBody(data: any): any {
  if (!data) return null;

  try {
    // Parse if string
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Extract only key fields for common responses
    if (parsed.sessionId) {
      return { sessionId: parsed.sessionId, status: parsed.status };
    }
    
    if (parsed.error) {
      return { error: parsed.error, message: parsed.message };
    }
    
    // Limit size
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length > 1024) {
      return { _truncated: true, _size: str.length };
    }
    
    return parsed;
  } catch (error) {
    return { _error: 'Failed to sanitize response body' };
  }
}

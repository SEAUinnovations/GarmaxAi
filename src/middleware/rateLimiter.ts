import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/winston-logger';
import type { ApiKeyRequest } from '../types/enterprise';

/**
 * In-memory rate limit tracker using token bucket algorithm
 * In production, use Redis for distributed tracking
 */
class RateLimitStore {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute

  /**
   * Check if request should be allowed based on rate limit
   * @param key - Unique identifier (orgId:apiKeyId)
   * @param limit - Requests per minute
   * @returns Object with allowed status and remaining tokens
   */
  check(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || now - bucket.lastRefill >= this.windowMs) {
      // Refill bucket
      bucket = { tokens: limit, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const resetAt = new Date(bucket.lastRefill + this.windowMs);

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { allowed: true, remaining: bucket.tokens, resetAt };
    }

    return { allowed: false, remaining: 0, resetAt };
  }

  /**
   * Clean up old buckets periodically
   */
  cleanup(): void {
    const now = Date.now();
    const staleTime = this.windowMs * 2; // 2 minutes

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleTime) {
        this.buckets.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Cleanup old buckets every 5 minutes
setInterval(() => rateLimitStore.cleanup(), 5 * 60 * 1000);

/**
 * Rate limiting middleware using token bucket algorithm
 * Limits requests per organization/API key per minute
 * 
 * Must be applied AFTER apiKeyAuth middleware
 */
export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKeyReq = req as ApiKeyRequest;

  // Ensure API key auth has run
  if (!apiKeyReq.organizationId || !apiKeyReq.apiKeyId) {
    logger.error('Rate limiter called before API key auth', 'rateLimiter');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication middleware not configured'
    });
    return;
  }

  // Get rate limit (per-key limit or org default)
  const limit = apiKeyReq.apiKeyRateLimit || 60;

  // Create unique key for this API key
  const rateLimitKey = `${apiKeyReq.organizationId}:${apiKeyReq.apiKeyId}`;

  // Check rate limit
  const { allowed, remaining, resetAt } = rateLimitStore.check(rateLimitKey, limit);

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString());

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());

    logger.warn(`Rate limit exceeded: org=${apiKeyReq.organizationId}, key=${apiKeyReq.apiKeyId}`, 'rateLimiter');
    
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${limit} requests per minute exceeded`,
      retryAfter,
      resetAt: resetAt.toISOString()
    });
    return;
  }

  next();
}

/**
 * Custom rate limiter with configurable limits
 * Useful for specific endpoints that need different limits
 * 
 * @param customLimit - Requests per minute for this endpoint
 */
export function customRateLimiter(customLimit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKeyReq = req as ApiKeyRequest;

    if (!apiKeyReq.organizationId || !apiKeyReq.apiKeyId) {
      logger.error('Custom rate limiter called before API key auth', 'rateLimiter');
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authentication middleware not configured'
      });
      return;
    }

    const rateLimitKey = `${apiKeyReq.organizationId}:${apiKeyReq.apiKeyId}:${req.path}`;
    const { allowed, remaining, resetAt } = rateLimitStore.check(rateLimitKey, customLimit);

    res.setHeader('X-RateLimit-Limit', customLimit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString());

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      logger.warn(`Custom rate limit exceeded: endpoint=${req.path}`, 'rateLimiter');
      
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit of ${customLimit} requests per minute exceeded for this endpoint`,
        retryAfter,
        resetAt: resetAt.toISOString()
      });
      return;
    }

    next();
  };
}

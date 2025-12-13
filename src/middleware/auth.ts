import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/winston-logger';
import { storage } from '../storage';
import { verifyCognitoJWT, decodeJWTUnsafe } from '../utils/jwtVerification';
import { 
  CognitoIdentityProviderClient, 
  GetUserCommand 
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

interface CognitoJWTPayload {
  sub: string; // Cognito user ID
  email: string;
  email_verified: boolean;
  aud: string; // Client ID
  event_id: string;
  token_use: string;
  auth_time: number;
  iat: number;
  exp: number;
}

/**
 * Middleware to verify Cognito JWT token and attach user info to request
 * Use this on protected routes that require authentication
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN' 
    });
  }

  try {
    // Verify JWT signature and decode payload
    const payload = await verifyCognitoJWT(token);
    
    // Extract email from token (could be in 'email' or 'username' claim)
    const email = payload.email || payload.username;
    if (!email) {
      return res.status(401).json({ 
        error: 'Invalid token - no email found',
        code: 'INVALID_TOKEN' 
      });
    }
    
    // Get user from database
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }
    
    // Attach user info to request for use in route handlers
    (req as any).userId = user.id;
    (req as any).userEmail = email;
    (req as any).cognitoSub = payload.sub;
    
    logger.info(`Authenticated request for user: ${user.id} (${email})`, 'authMiddleware');
    next();
  } catch (error: any) {
    logger.error(`JWT authentication error: ${error.message || error}`, 'authMiddleware');
    
    // Map error codes to appropriate HTTP responses
    if (error.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({ 
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED' 
      });
    } else if (error.message === 'INVALID_TOKEN') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN' 
      });
    } else {
      return res.status(401).json({ 
        error: 'Token validation failed',
        code: 'INVALID_TOKEN' 
      });
    }
  }
}

/**
 * Optional authentication middleware - attaches user if token is present, 
 * but doesn't fail if token is missing or invalid
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    // Verify JWT signature
    const payload = await verifyCognitoJWT(token);
    
    const email = payload.email || payload.username;
    if (email) {
      const user = await storage.getUserByEmail(email);
      if (user) {
        (req as any).userId = user.id;
        (req as any).userEmail = email;
        (req as any).cognitoSub = payload.sub;
        logger.info(`Optional auth: authenticated user ${user.id}`, 'authMiddleware');
      }
    }
  } catch (error) {
    // Ignore auth errors for optional auth
    logger.warn(`Optional auth failed: ${error}`, 'authMiddleware');
  }

  next();
}

/**
 * Middleware to check if user's trial is still active
 * Should be used after authenticateToken
 */
export async function requireActiveTrial(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }

    if (user.trialStatus !== 'active' || (user.trialExpiresAt && new Date() > user.trialExpiresAt)) {
      return res.status(403).json({ 
        error: 'Trial expired. Please upgrade your account.',
        code: 'TRIAL_EXPIRED',
        trialExpiresAt: user.trialExpiresAt 
      });
    }

    logger.info(`Trial check passed for user: ${userId}`, 'authMiddleware');
    next();
  } catch (error) {
    logger.error(`Trial check error: ${error}`, 'authMiddleware');
    res.status(500).json({ 
      error: 'Failed to verify trial status',
      code: 'TRIAL_CHECK_ERROR' 
    });
  }
}

/**
 * Middleware to check if user has sufficient credits for an operation
 */
export function requireCredits(creditsNeeded: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED' 
        });
      }

      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND' 
        });
      }

      if (user.creditsRemaining < creditsNeeded) {
        return res.status(403).json({ 
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          required: creditsNeeded,
          available: user.creditsRemaining 
        });
      }

      // Attach credits info to request for use in route handler
      (req as any).creditsRequired = creditsNeeded;
      
      logger.info(`Credits check passed for user: ${userId} (${creditsNeeded} credits)`, 'authMiddleware');
      next();
    } catch (error) {
      logger.error(`Credits check error: ${error}`, 'authMiddleware');
      res.status(500).json({ 
        error: 'Failed to verify credits',
        code: 'CREDITS_CHECK_ERROR' 
      });
    }
  };
}

/**
 * Verify Cognito JWT token without middleware (for utility usage)
 */
export async function verifyCognitoToken(token: string): Promise<any | null> {
  try {
    const getUserCommand = new GetUserCommand({
      AccessToken: token
    });
    
    const cognitoUser = await cognitoClient.send(getUserCommand);
    return cognitoUser;
  } catch {
    return null;
  }
}

// Legacy middleware for backward compatibility
export const requireAuth = authenticateToken;
export const setUser = optionalAuth;

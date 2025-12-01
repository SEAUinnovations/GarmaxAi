import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/winston-logger';
import { storage } from '../storage';
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
    // Verify token with Cognito by making a GetUser call
    const getUserCommand = new GetUserCommand({
      AccessToken: token
    });
    
    const cognitoUser = await cognitoClient.send(getUserCommand);
    
    // Extract user info from Cognito response
    const email = cognitoUser.UserAttributes?.find(attr => attr.Name === 'email')?.Value;
    const emailVerified = cognitoUser.UserAttributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true';
    
    if (!email) {
      return res.status(401).json({ 
        error: 'Invalid token - no email found',
        code: 'INVALID_TOKEN' 
      });
    }
    
    // Get or create local user record
    let user = await storage.getUserByEmail(email);
    if (!user) {
      // Create user record if it doesn't exist
      const displayName = cognitoUser.UserAttributes?.find(attr => attr.Name === 'custom:display_name')?.Value || 
                         cognitoUser.UserAttributes?.find(attr => attr.Name === 'name')?.Value ||
                         email.split('@')[0];
      
      user = await storage.createUser({
        username: displayName,
        email,
        password: 'cognito_managed',
        emailVerified,
        trialExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        trialStatus: 'active'
      });
    }
    
    // Attach user info to request for use in route handlers
    (req as any).userId = user.id;
    (req as any).userEmail = email;
    (req as any).cognitoSub = cognitoUser.Username;
    
    logger.info(`Authenticated request for user: ${user.id} (${email})`, 'authMiddleware');
    next();
  } catch (error: any) {
    logger.error(`Cognito authentication error: ${error}`, 'authMiddleware');
    
    if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ 
        error: 'Token has expired or is invalid',
        code: 'TOKEN_EXPIRED' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Authentication failed',
        code: 'AUTH_ERROR' 
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
    const getUserCommand = new GetUserCommand({
      AccessToken: token
    });
    
    const cognitoUser = await cognitoClient.send(getUserCommand);
    const email = cognitoUser.UserAttributes?.find(attr => attr.Name === 'email')?.Value;
    
    if (email) {
      const user = await storage.getUserByEmail(email);
      if (user) {
        (req as any).userId = user.id;
        (req as any).userEmail = email;
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

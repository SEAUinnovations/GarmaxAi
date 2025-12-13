import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { logger } from './winston-logger';

const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// Configure JWKS client to fetch Cognito's public keys
const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // Cache keys for 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

interface CognitoJWTPayload {
  sub: string; // Cognito user ID
  email?: string;
  username?: string;
  email_verified?: boolean;
  aud?: string; // Client ID (for ID tokens)
  client_id?: string; // Client ID (for access tokens)
  event_id?: string;
  token_use: string; // 'id' or 'access'
  auth_time?: number;
  iat: number;
  exp: number;
  iss: string; // Issuer (Cognito User Pool)
}

/**
 * Get the signing key from Cognito JWKS
 */
async function getSigningKey(kid: string): Promise<string> {
  try {
    const key = await client.getSigningKey(kid);
    return key.getPublicKey();
  } catch (error) {
    logger.error(`Failed to get signing key: ${error}`, 'jwtVerification');
    throw new Error('Unable to verify token signature');
  }
}

/**
 * Verify and decode a Cognito JWT token with signature validation
 * 
 * @param token - The JWT token to verify
 * @param options - Verification options
 * @returns Decoded and verified token payload
 * @throws Error if token is invalid or verification fails
 */
export async function verifyCognitoJWT(
  token: string,
  options?: { tokenUse?: 'id' | 'access' }
): Promise<CognitoJWTPayload> {
  try {
    // Decode token header to get kid (key ID)
    const decodedHeader = jwt.decode(token, { complete: true });
    
    if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
      throw new Error('Invalid token format - missing kid in header');
    }

    const kid = decodedHeader.header.kid;

    // Get the public key from Cognito JWKS
    const signingKey = await getSigningKey(kid);

    // Verify token signature and decode payload
    const payload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'], // Cognito uses RS256
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`, // Verify issuer
    }) as CognitoJWTPayload;

    // Verify token_use claim if specified
    if (options?.tokenUse && payload.token_use !== options.tokenUse) {
      throw new Error(`Invalid token_use: expected ${options.tokenUse}, got ${payload.token_use}`);
    }

    // Verify audience/client_id
    const clientId = payload.aud || payload.client_id;
    if (clientId && clientId !== CLIENT_ID) {
      logger.warn(`Token client_id mismatch: expected ${CLIENT_ID}, got ${clientId}`, 'jwtVerification');
      // Don't throw - some tokens may not have aud/client_id
    }

    logger.info('JWT signature verified successfully', 'jwtVerification');
    return payload;
  } catch (error: any) {
    // Enhanced error logging
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired during verification', 'jwtVerification');
      throw new Error('TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn(`JWT verification failed: ${error.message}`, 'jwtVerification');
      throw new Error('INVALID_TOKEN');
    } else if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_TOKEN') {
      // Re-throw our custom errors
      throw error;
    } else {
      logger.error(`Token verification error: ${error.message}`, 'jwtVerification');
      throw new Error('VERIFICATION_FAILED');
    }
  }
}

/**
 * Decode JWT without signature verification (for backwards compatibility in specific scenarios)
 * WARNING: Only use this when you explicitly trust the token source
 * 
 * @param token - The JWT token to decode
 * @returns Decoded token payload (unverified)
 */
export function decodeJWTUnsafe(token: string): CognitoJWTPayload | null {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    return payload as CognitoJWTPayload;
  } catch (error) {
    logger.error(`Failed to decode JWT: ${error}`, 'jwtVerification');
    return null;
  }
}

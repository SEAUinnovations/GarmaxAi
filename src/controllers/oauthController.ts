import { Request, Response } from 'express';
import { CognitoIdentityProviderClient, InitiateAuthCommand, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '../utils/winston-logger';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN; // e.g., garmaxai-prod.auth.us-east-1.amazoncognito.com

/**
 * Handle OAuth callback from Cognito
 * Exchanges authorization code for tokens
 */
export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Missing authorization code' });
    }

    if (!USER_POOL_ID || !CLIENT_ID || !COGNITO_DOMAIN) {
      logger.error('Missing Cognito configuration', 'AuthController');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // The redirect_uri MUST match exactly what was used in the initial OAuth request
    const finalRedirectUri = redirectUri || `${process.env.FRONTEND_URL}/auth/callback`;
    
    logger.info(`OAuth callback received - code: ${code.substring(0, 10)}..., redirectUri: ${finalRedirectUri}`, 'AuthController');

    // Exchange authorization code for tokens
    const tokenEndpoint = `https://${COGNITO_DOMAIN}/oauth2/token`;
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: finalRedirectUri,
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText };
      }
      logger.error(`Token exchange failed: ${tokenResponse.status} - ${JSON.stringify(errorData)}`, 'AuthController');
      return res.status(400).json({ 
        message: 'Failed to exchange authorization code',
        details: process.env.NODE_ENV === 'development' ? errorData : undefined
      });
    }

    const tokens = await tokenResponse.json();
    const { access_token, id_token, refresh_token } = tokens;

    // Decode the id_token to get user information
    // id_token is a JWT with user claims - we can decode it without verification
    // since it came directly from Cognito's token endpoint
    const base64Payload = id_token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    logger.info(`Decoded id_token for user: ${payload.email}`, 'AuthController');

    // Check if user exists in database, create if not
    const user = await findOrCreateUserFromCognito({
      cognitoId: payload.sub, // Cognito user ID from 'sub' claim
      email: payload.email || '',
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture,
    });

    logger.info(`OAuth login successful for user: ${user.email}`, 'AuthController');

    // Return tokens and user data
    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        trialExpiresAt: user.trialExpiresAt,
        trialStatus: user.trialStatus,
        subscriptionTier: user.subscriptionTier,
        creditsRemaining: user.creditsRemaining,
      },
      accessToken: access_token,
      idToken: id_token,
      refreshToken: refresh_token,
    });
  } catch (error) {
    logger.error(`OAuth callback error: ${error}`, 'AuthController');
    res.status(500).json({ message: 'Authentication failed' });
  }
}

/**
 * Find or create user from Cognito attributes
 */
async function findOrCreateUserFromCognito(cognitoUser: {
  cognitoId: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  picture?: string;
}) {
  // This is a placeholder - implement with your actual database logic
  // You'll need to:
  // 1. Check if user exists by cognitoId or email
  // 2. If not, create new user with initial trial/credits
  // 3. Return the user object
  
  // Example (adjust to your storage implementation):
  const { storage } = await import('../storage');
  
  let user = await storage.getUserByEmail(cognitoUser.email);
  
  if (!user) {
    // Create new user
    user = await storage.createUserFromOAuth({
      cognitoId: cognitoUser.cognitoId,
      email: cognitoUser.email,
      emailVerified: cognitoUser.emailVerified,
      name: `${cognitoUser.givenName || ''} ${cognitoUser.familyName || ''}`.trim(),
      profilePicture: cognitoUser.picture,
    });
  }

  if (!user) {
    throw new Error('Failed to find or create user');
  }
  
  return user;
}

/**
 * Initiate Google OAuth flow
 */
export async function initiateGoogleLogin(req: Request, res: Response) {
  try {
    if (!COGNITO_DOMAIN || !CLIENT_ID) {
      logger.error(
        `Missing Cognito configuration for Google login: hasCognitoDomain=${!!COGNITO_DOMAIN}, hasClientId=${!!CLIENT_ID}`,
        'AuthController'
      );
      return res.status(500).json({ message: 'Server configuration error' });
    }

    if (!process.env.FRONTEND_URL) {
      logger.error('Missing FRONTEND_URL configuration', 'AuthController');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const { returnTo } = req.query;
    const redirectUri = `${process.env.FRONTEND_URL}/auth/callback`;

    // Build Cognito OAuth URL
    const authUrl = new URL(`https://${COGNITO_DOMAIN}/oauth2/authorize`);
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'email openid profile');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('identity_provider', 'Google');
    
    if (returnTo) {
      authUrl.searchParams.set('state', returnTo as string);
    }

    res.json({ authUrl: authUrl.toString() });
  } catch (error) {
    logger.error(`Failed to initiate Google login: ${error}`, 'AuthController');
    res.status(500).json({ message: 'Failed to initiate login' });
  }
}

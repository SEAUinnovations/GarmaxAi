import { Request, Response } from "express";
import { storage } from "../storage";
import { creditsService } from "../services/creditsService";
import { logger } from "../utils/winston-logger";
import { insertUserSchema } from "@shared/schema";
import { 
  CognitoIdentityProviderClient, 
  SignUpCommand, 
  ConfirmSignUpCommand, 
  InitiateAuthCommand, 
  ResendConfirmationCodeCommand,
  GetUserCommand,
  AuthFlowType,
  ChallengeNameType
} from '@aws-sdk/client-cognito-identity-provider';
import jwt from 'jsonwebtoken';

// AWS Cognito configuration
const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5001';

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// Warn if Cognito is not configured (don't throw, allow other auth methods)
if (!USER_POOL_ID || !CLIENT_ID) {
  console.warn('[authController] Cognito configuration missing. OAuth sign-in will not be available. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID to enable.');
}

/**
 * @description Register a new user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate using Zod schema
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid registration data", details: parsed.error.errors });
      return;
    }

    const { username, email, password } = parsed.data;

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    // Register user in Cognito
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email, // Use email as username in Cognito
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: username },
        { Name: 'custom:display_name', Value: username }
      ]
    });

    const signUpResult = await cognitoClient.send(signUpCommand);

    // Create user record in local storage
    const user = await storage.createUser({ 
      username, 
      email, 
      password: 'cognito_managed', // Placeholder since Cognito handles passwords
      emailVerified: false,
      trialExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days trial
      trialStatus: 'active'
    });

    // Award trial credits
    await creditsService.awardTrialCredits(user.id);

    logger.info(`User registered in Cognito: ${email}`, "authController");

    res.status(201).json({
      message: "User registered successfully. Please check your email for verification code.",
      requiresVerification: true,
      userId: signUpResult.UserSub,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        emailVerified: false,
        trialExpiresAt: user.trialExpiresAt,
        trialStatus: user.trialStatus,
        subscriptionTier: user.subscriptionTier || 'free',
        creditsRemaining: user.creditsRemaining || 0
      },
    });
  } catch (error: any) {
    logger.error(`Registration error: ${error}`, "authController");
    
    // Handle Cognito-specific errors
    if (error.name === 'UsernameExistsException') {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    
    if (error.name === 'InvalidPasswordException') {
      res.status(400).json({ error: "Password does not meet requirements" });
      return;
    }
    
    res.status(500).json({ error: "Failed to register user" });
  }
}

/**
 * @description Login user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Authenticate with Cognito
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    const authResult = await cognitoClient.send(authCommand);

    if (!authResult.AuthenticationResult?.AccessToken) {
      res.status(401).json({ error: "Authentication failed" });
      return;
    }

    // Get user details from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: authResult.AuthenticationResult.AccessToken
    });
    
    const cognitoUser = await cognitoClient.send(getUserCommand);
    const userEmail = cognitoUser.UserAttributes?.find(attr => attr.Name === 'email')?.Value;
    const displayName = cognitoUser.UserAttributes?.find(attr => attr.Name === 'custom:display_name')?.Value || 
                       cognitoUser.UserAttributes?.find(attr => attr.Name === 'name')?.Value;

    // Get or create user record in local storage
    let user = await storage.getUserByEmail(userEmail!);
    if (!user) {
      user = await storage.createUser({
        username: displayName || userEmail!.split('@')[0],
        email: userEmail!,
        password: 'cognito_managed',
        emailVerified: cognitoUser.UserAttributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true',
        trialExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days trial
        trialStatus: 'active'
      });
      
      // Award trial credits for new user
      await creditsService.awardTrialCredits(user.id);
    }

    logger.info(`User logged in: ${user.id} (${userEmail})`, "authController");

    res.status(200).json({
      message: "Login successful",
      token: authResult.AuthenticationResult.AccessToken, // Use Cognito JWT token
      refreshToken: authResult.AuthenticationResult.RefreshToken,
      idToken: authResult.AuthenticationResult.IdToken,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        emailVerified: user.emailVerified || false,
        trialExpiresAt: user.trialExpiresAt,
        trialStatus: user.trialStatus,
        subscriptionTier: user.subscriptionTier || 'free',
        creditsRemaining: user.creditsRemaining || 0
      },
    });
  } catch (error: any) {
    logger.error(`Login error: ${error}`, "authController");
    
    // Handle Cognito-specific errors
    if (error.name === 'NotAuthorizedException') {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    
    if (error.name === 'UserNotConfirmedException') {
      res.status(401).json({ 
        error: "Email not verified. Please check your email for verification code.",
        requiresVerification: true
      });
      return;
    }
    
    res.status(500).json({ error: "Failed to login" });
  }
}

/**
 * @description Logout user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function logout(req: Request, res: Response) {
  try {
    // TODO: In production, invalidate JWT token (add to blacklist)
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error(`Logout error: ${error}`, "authController");
    res.status(500).json({ error: "Failed to logout" });
  }
}

/**
 * @description Get current user from JWT token
 * @param req - Express request object with auth middleware
 * @param res - Express response object
 */
export async function me(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const user = await storage.getUserById(userId);
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified || false,
      trialExpiresAt: user.trialExpiresAt,
      trialStatus: user.trialStatus,
      subscriptionTier: user.subscriptionTier || 'free',
      creditsRemaining: user.creditsRemaining || 0
    });
  } catch (error) {
    logger.error(`Get user error: ${error}`, "authController");
    res.status(500).json({ error: "Failed to get user info" });
  }
}

/**
 * @description Start free trial with email verification
 * @param req - Express request object
 * @param res - Express response object
 */
export async function startFreeTrial(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Generate temporary password and username for trial
    const tempPassword = generateTempPassword();
    const tempUsername = email.split('@')[0] + '_trial';

    // Register user in Cognito for trial
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: tempPassword,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: tempUsername },
        { Name: 'custom:display_name', Value: tempUsername },
        { Name: 'custom:trial_user', Value: 'true' }
      ]
    });

    const signUpResult = await cognitoClient.send(signUpCommand);

    logger.info(`Free trial started for email: ${email}`, "authController");

    res.status(200).json({
      requiresVerification: true,
      message: "Verification code sent to your email",
      tempPassword // Send temp password so user can login after verification
    });
  } catch (error: any) {
    logger.error(`Start free trial error: ${error}`, "authController");
    
    if (error.name === 'UsernameExistsException') {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    
    res.status(500).json({ error: "Failed to start free trial" });
  }
}

/**
 * @description Verify trial email and create user account
 * @param req - Express request object
 * @param res - Express response object
 */
export async function verifyTrialEmail(req: Request, res: Response) {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      res.status(400).json({ error: "Email and verification code are required" });
      return;
    }

    // Confirm signup in Cognito
    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: verificationCode
    });

    await cognitoClient.send(confirmCommand);

    // Create or update user record in local storage
    let user = await storage.getUserByEmail(email);
    if (!user) {
      const username = email.split('@')[0] + '_trial';
      user = await storage.createUser({
        username,
        email,
        password: 'cognito_managed',
        emailVerified: true,
        trialExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days trial
        trialStatus: 'active'
      });
      
      // Award trial credits
      await creditsService.awardTrialCredits(user.id);
    } else {
      // Update verification status
      user.emailVerified = true;
    }

    // Now authenticate to get JWT token
    // Note: User will need to login with their temp password after verification
    
    logger.info(`Trial email verified for user: ${email}`, "authController");

    res.status(200).json({
      message: "Email verified successfully. You can now login with your credentials.",
      verified: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: true,
        trialExpiresAt: user.trialExpiresAt,
        trialStatus: user.trialStatus,
        subscriptionTier: 'free',
        creditsRemaining: user.creditsRemaining || 0
      }
    });
  } catch (error: any) {
    logger.error(`Verify trial email error: ${error}`, "authController");
    
    if (error.name === 'CodeMismatchException') {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    
    if (error.name === 'ExpiredCodeException') {
      res.status(400).json({ error: "Verification code has expired" });
      return;
    }
    
    res.status(500).json({ error: "Failed to verify email" });
  }
}

/**
 * @description Resend verification email
 * @param req - Express request object
 * @param res - Express response object
 */
export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Resend confirmation code via Cognito
    const resendCommand = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email
    });

    await cognitoClient.send(resendCommand);

    logger.info(`Verification email resent to: ${email}`, "authController");

    res.status(200).json({
      message: "Verification code resent"
    });
  } catch (error: any) {
    logger.error(`Resend verification error: ${error}`, "authController");
    
    if (error.name === 'UserNotFoundException') {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.status(500).json({ error: "Failed to resend verification" });
  }
}

/**
 * @description Generate temporary password for trial users
 */
function generateTempPassword(): string {
  // Generate a secure temporary password that meets Cognito requirements
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const specialChars = '!@#$%^&*';
  let password = '';
  
  // Ensure at least one uppercase, lowercase, number, and special char
  password += 'A'; // uppercase
  password += 'a'; // lowercase
  password += '1'; // number
  password += '!'; // special char
  
  // Fill rest with random chars
  for (let i = 4; i < 12; i++) {
    const allChars = chars + specialChars;
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

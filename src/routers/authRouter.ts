import { Router } from "express";
import * as authController from "../controllers/authController";
import * as oauthController from "../controllers/oauthController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user account
 *     description: Creates a new user account with username, email, and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 2
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email already exists
 *       500:
 *         description: Internal server error
 */
router.post("/register", authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login with email and password
 *     description: Authenticates user credentials and returns JWT session cookie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: JWT authentication cookie
 *             schema:
 *               type: string
 *               example: auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: Login successful
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid email or password
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout current user
 *     description: Clears authentication cookie and logs out the user
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
router.post("/logout", authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current authenticated user
 *     description: Returns the current user's information based on JWT token
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Access denied. No token provided.
 */
router.get("/me", authenticateToken, authController.me);

/**
 * @swagger
 * /auth/start-free-trial:
 *   post:
 *     tags: [Authentication]
 *     summary: Start free trial with email verification
 *     description: Initiates a free trial by sending verification email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: trial@example.com
 *     responses:
 *       200:
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email sent. Please check your inbox.
 *       400:
 *         description: Invalid email or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email already exists
 */
router.post("/start-free-trial", authController.startFreeTrial);

/**
 * @swagger
 * /auth/verify-trial-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify trial email with token
 *     description: Completes free trial registration with email verification token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 example: abc123def456
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Trial account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: Account created successfully
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired verification token
 */
router.post("/verify-trial-email", authController.verifyTrialEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend verification email
 *     description: Resends verification email for pending trial accounts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: trial@example.com
 *     responses:
 *       200:
 *         description: Verification email resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email resent
 *       404:
 *         description: No pending trial found for email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No pending trial found for this email
 */
router.post("/resend-verification", authController.resendVerification);

/**
 * @swagger
 * /auth/oauth/google:
 *   get:
 *     tags: [Authentication]
 *     summary: Initiate Google OAuth flow
 *     description: Returns the Google OAuth authorization URL to redirect the user to
 *     parameters:
 *       - in: query
 *         name: returnTo
 *         schema:
 *           type: string
 *         description: Optional return URL after successful authentication
 *     responses:
 *       200:
 *         description: OAuth URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *                   example: https://garmaxai-prod.auth.us-east-1.amazoncognito.com/oauth2/authorize?...
 *       500:
 *         description: Server configuration error
 */
router.get("/oauth/google", oauthController.initiateGoogleLogin);

/**
 * @swagger
 * /auth/oauth/callback:
 *   post:
 *     tags: [Authentication]
 *     summary: Handle OAuth callback
 *     description: Exchanges authorization code for tokens and creates/updates user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from OAuth provider
 *               state:
 *                 type: string
 *                 description: State parameter for CSRF protection
 *               redirectUri:
 *                 type: string
 *                 description: The redirect URI used in the auth request
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:oo,olokmbkhkokhghi
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 idToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Invalid authorization code
 *       500:
 *         description: Authentication failed
 */
router.post("/oauth/callback", oauthController.handleOAuthCallback);

export default router;

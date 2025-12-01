import { Router } from "express";
import * as userController from "../controllers/userController";

const router = Router();

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [User Profile]
 *     summary: Get authenticated user's profile
 *     description: Returns the current user's basic profile information
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
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
router.get("/profile", userController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     tags: [User Profile]
 *     summary: Update authenticated user's profile
 *     description: Updates the current user's basic profile information
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 2
 *                 example: johndoe_updated
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newemail@example.com
 *               profilePicture:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/avatar.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Username already exists
 *       401:
 *         description: Not authenticated
 */
router.patch("/profile", userController.updateProfile);

/**
 * @swagger
 * /users/profile/physical:
 *   get:
 *     tags: [Physical Profile]
 *     summary: Get user's physical profile
 *     description: Returns the current user's physical measurements and characteristics
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Physical profile data
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/PhysicalProfile'
 *                 - type: null
 *       401:
 *         description: Not authenticated
 */
router.get("/profile/physical", userController.getPhysicalProfile);

/**
 * @swagger
 * /users/profile/physical:
 *   patch:
 *     tags: [Physical Profile]
 *     summary: Update user's physical profile
 *     description: Updates or creates the current user's physical measurements and characteristics
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               measurementSystem:
 *                 type: string
 *                 enum: [imperial, metric]
 *                 example: imperial
 *               height:
 *                 type: number
 *                 minimum: 0
 *                 example: 70
 *               weight:
 *                 type: number
 *                 minimum: 0
 *                 example: 150
 *               bodyType:
 *                 type: string
 *                 enum: [pear, apple, hourglass, rectangle, inverted_triangle]
 *                 example: hourglass
 *               chest:
 *                 type: number
 *                 minimum: 0
 *                 example: 36
 *               waist:
 *                 type: number
 *                 minimum: 0
 *                 example: 28
 *               hips:
 *                 type: number
 *                 minimum: 0
 *                 example: 38
 *               shoulderWidth:
 *                 type: number
 *                 minimum: 0
 *                 example: 16
 *               armLength:
 *                 type: number
 *                 minimum: 0
 *                 example: 24
 *               legLength:
 *                 type: number
 *                 minimum: 0
 *                 example: 32
 *               neckSize:
 *                 type: number
 *                 minimum: 0
 *                 example: 14
 *               shoeSize:
 *                 type: number
 *                 minimum: 0
 *                 example: 8
 *               skinTone:
 *                 type: string
 *                 enum: [fair, light, medium, tan, dark, deep]
 *                 example: medium
 *               hairColor:
 *                 type: string
 *                 example: brown
 *               eyeColor:
 *                 type: string
 *                 example: blue
 *               fitPreference:
 *                 type: string
 *                 enum: [tight, fitted, regular, loose, oversized]
 *                 example: fitted
 *     responses:
 *       200:
 *         description: Physical profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PhysicalProfile'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid measurement values
 *       401:
 *         description: Not authenticated
 */
router.patch("/profile/physical", userController.updatePhysicalProfile);

/**
 * @swagger
 * /users/profile/benefits:
 *   get:
 *     tags: [User Profile]
 *     summary: Get profile completion benefits
 *     description: Returns profile completion percentage and associated benefits
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile completion data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 completionPercentage:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 100
 *                   example: 75
 *                 benefits:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Better fit recommendations", "Advanced try-on features"]
 *       401:
 *         description: Not authenticated
 */
router.get("/profile/benefits", userController.getProfileBenefits);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     tags: [User Profile]
 *     summary: Get public user profile
 *     description: Returns public information for a specific user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to fetch profile for
 *         example: user_123abc
 *     responses:
 *       200:
 *         description: Public user profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: user_123abc
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 profilePicture:
 *                   type: string
 *                   format: uri
 *                   example: https://example.com/avatar.jpg
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 */
router.get("/:userId", userController.getPublicProfile);

export default router;

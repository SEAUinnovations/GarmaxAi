import { Router } from "express";
import * as creditsController from "../controllers/creditsController";

const router = Router();

/**
 * @swagger
 * /credits:
 *   get:
 *     tags: [Credits]
 *     summary: Get user's credit balance
 *     description: Returns the current user's credit balance, monthly quota, and usage statistics
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Credit balance information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: integer
 *                   minimum: 0
 *                   description: Current credit balance
 *                   example: 45
 *                 monthlyQuota:
 *                   type: integer
 *                   minimum: 0
 *                   description: Monthly credit quota based on subscription
 *                   example: 100
 *                 used:
 *                   type: integer
 *                   minimum: 0
 *                   description: Credits used in current billing period
 *                   example: 55
 *                 resetDate:
 *                   type: string
 *                   format: date-time
 *                   description: When credits reset for next billing period
 *                   example: "2024-02-01T00:00:00.000Z"
 *       401:
 *         description: Not authenticated
 */
router.get("/", creditsController.getCredits);

/**
 * @swagger
 * /credits:
 *   post:
 *     tags: [Credits]
 *     summary: Add credits to account
 *     description: Adds credits to the user's account (typically used with payment processing)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of credits to add
 *                 example: 50
 *               reason:
 *                 type: string
 *                 description: Reason for credit addition
 *                 example: "Purchase - Premium Pack"
 *               transactionId:
 *                 type: string
 *                 description: Payment transaction ID for record keeping
 *                 example: "txn_abc123def456"
 *     responses:
 *       200:
 *         description: Credits added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "50 credits added successfully"
 *                 newBalance:
 *                   type: integer
 *                   example: 95
 *                 transactionId:
 *                   type: string
 *                   example: "txn_abc123def456"
 *       400:
 *         description: Invalid credit amount or transaction data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid credit amount
 *       401:
 *         description: Not authenticated
 */
router.post("/", creditsController.addCredits);

/**
 * @swagger
 * /credits/check:
 *   get:
 *     tags: [Credits]
 *     summary: Check if user has required credits
 *     description: Validates if the user has sufficient credits for a specific operation
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: required
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Number of credits required for the operation
 *         example: 5
 *       - in: query
 *         name: operation
 *         schema:
 *           type: string
 *           enum: [try-on-sd, try-on-hd, try-on-4k, avatar-creation]
 *         description: Type of operation to check credits for
 *         example: try-on-hd
 *     responses:
 *       200:
 *         description: Credit check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasCredits:
 *                   type: boolean
 *                   description: Whether user has sufficient credits
 *                   example: true
 *                 currentBalance:
 *                   type: integer
 *                   description: User's current credit balance
 *                   example: 45
 *                 required:
 *                   type: integer
 *                   description: Credits required for the operation
 *                   example: 5
 *                 remaining:
 *                   type: integer
 *                   description: Credits remaining after operation (if sufficient)
 *                   example: 40
 *       400:
 *         description: Invalid credit check parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Required credits parameter is missing
 *       401:
 *         description: Not authenticated
 */
router.get("/check", creditsController.checkCredits);

/**
 * @swagger
 * /credits/purchase:
 *   post:
 *     tags: [Credits]
 *     summary: Create Stripe checkout for credit purchase
 *     description: Creates a Stripe checkout session for one-time credit purchase
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credits]
 *             properties:
 *               credits:
 *                 type: integer
 *                 description: Number of credits to purchase (30, 100, or 500)
 *                 example: 100
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 url:
 *                   type: string
 *       400:
 *         description: Invalid credit pack
 *       401:
 *         description: Not authenticated
 */
router.post("/purchase", creditsController.createCreditPurchase);

export default router;

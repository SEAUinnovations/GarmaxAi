import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createTryonSession,
  getTryonSession,
  getUserTryonSessions,
  confirmPreview,
  cancelTryonSession,
  getSessionStatus,
} from "../controllers/tryonController";

export const tryonRouter = Router();

// All routes require authentication
tryonRouter.use(requireAuth);

/**
 * @swagger
 * /tryon/session/create:
 *   post:
 *     tags: [Try-On Sessions]
 *     summary: Create a new try-on session
 *     description: Initiates a new virtual try-on session with specified avatar and garments
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [photoId, garmentIds, preferences]
 *             properties:
 *               photoId:
 *                 type: string
 *                 description: ID of the user's avatar photo
 *                 example: photo_123abc
 *               garmentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of garment IDs to try on
 *                 example: ["garment_456def", "garment_789ghi"]
 *               preferences:
 *                 type: object
 *                 required: [renderQuality]
 *                 properties:
 *                   renderQuality:
 *                     type: string
 *                     enum: [sd, hd, 4k]
 *                     example: hd
 *                   backgroundScene:
 *                     type: string
 *                     enum: [studio, urban, outdoor, custom]
 *                     example: studio
 *                   customBackgroundPrompt:
 *                     type: string
 *                     description: Custom background description (required if backgroundScene is 'custom')
 *                     example: "Modern office setting with natural lighting"
 *     responses:
 *       201:
 *         description: Try-on session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TryonSession'
 *       400:
 *         description: Invalid request data or insufficient credits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Insufficient credits for HD rendering
 *       401:
 *         description: Not authenticated
 */
tryonRouter.post("/session/create", createTryonSession);

/**
 * @swagger
 * /tryon/session/{sessionId}:
 *   get:
 *     tags: [Try-On Sessions]
 *     summary: Get try-on session details
 *     description: Retrieves the current status and details of a specific try-on session
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The try-on session ID
 *         example: session_123abc
 *     responses:
 *       200:
 *         description: Try-on session details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TryonSession'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Try-on session not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to access this session
 */
tryonRouter.get("/session/:sessionId", getTryonSession);

/**
 * @swagger
 * /tryon/sessions:
 *   get:
 *     tags: [Try-On Sessions]
 *     summary: Get user's try-on sessions
 *     description: Retrieves all try-on sessions for the authenticated user with pagination
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of sessions to return
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of sessions to skip
 *         example: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [queued, processing_avatar, applying_overlays, preview_ready, awaiting_confirmation, rendering_ai, completed, cancelled, failed]
 *         description: Filter by session status
 *         example: completed
 *     responses:
 *       200:
 *         description: List of user's try-on sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TryonSession'
 *                 total:
 *                   type: integer
 *                   example: 45
 *                 hasMore:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Not authenticated
 */
tryonRouter.get("/sessions", getUserTryonSessions);

/**
 * @swagger
 * /tryon/session/{sessionId}/confirm:
 *   post:
 *     tags: [Try-On Sessions]
 *     summary: Confirm try-on preview
 *     description: Confirms or rejects the overlay preview and proceeds to AI rendering if approved
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The try-on session ID
 *         example: session_123abc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approveOverlay]
 *             properties:
 *               approveOverlay:
 *                 type: boolean
 *                 description: Whether to approve the overlay and continue to AI rendering
 *                 example: true
 *     responses:
 *       200:
 *         description: Preview confirmation processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TryonSession'
 *       400:
 *         description: Session not in correct state for confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Session is not ready for confirmation
 *       404:
 *         description: Session not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to access this session
 */
tryonRouter.post("/session/:sessionId/confirm", confirmPreview);

/**
 * @swagger
 * /tryon/session/{sessionId}/cancel:
 *   post:
 *     tags: [Try-On Sessions]
 *     summary: Cancel try-on session
 *     description: Cancels an active try-on session and refunds credits if applicable
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The try-on session ID
 *         example: session_123abc
 *     responses:
 *       200:
 *         description: Session cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Try-on session cancelled successfully
 *                 refundedCredits:
 *                   type: integer
 *                   description: Number of credits refunded (if any)
 *                   example: 3
 *       400:
 *         description: Session cannot be cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cannot cancel completed session
 *       404:
 *         description: Session not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to access this session
 */
tryonRouter.post("/session/:sessionId/cancel", cancelTryonSession);

/**
 * @swagger
 * /tryon/session/{sessionId}/status:
 *   get:
 *     tags: [Try-On Sessions]
 *     summary: Get try-on session status
 *     description: Retrieves the current status of a try-on session (polling endpoint, WebSocket preferred)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The try-on session ID
 *     responses:
 *       200:
 *         description: Session status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 progress:
 *                   type: integer
 *                 previewUrl:
 *                   type: string
 *                 resultUrl:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                 completedAt:
 *                   type: string
 *       404:
 *         description: Session not found
 *       401:
 *         description: Not authenticated
 */
tryonRouter.get("/session/:sessionId/status", getSessionStatus);

/**
 * @swagger
 * /tryon/quota:
 *   get:
 *     tags: [Try-On Sessions]
 *     summary: Get user's try-on quota usage
 *     description: Returns the number of try-ons used in the current billing period
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Quota usage information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 used:
 *                   type: integer
 *                   description: Number of try-ons used this month
 *                   example: 3
 *                 period:
 *                   type: string
 *                   description: Billing period type
 *                   example: monthly
 *                 periodStart:
 *                   type: string
 *                   format: date-time
 *                   description: Start of current billing period
 *                   example: 2025-12-01T00:00:00.000Z
 *       401:
 *         description: Not authenticated
 */
tryonRouter.get("/quota", async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Import storage at function level to avoid circular dependencies
    const { storage } = await import("../storage");

    // Get sessions created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sessions = await storage.getUserTryonSessions?.(userId, 1000);
    const monthSessions = sessions?.filter(s => 
      new Date(s.createdAt) >= startOfMonth
    ) || [];

    res.json({
      used: monthSessions.length,
      period: 'monthly',
      periodStart: startOfMonth.toISOString()
    });
  } catch (error) {
    console.error('Get quota error:', error);
    res.status(500).json({ error: "Failed to fetch quota" });
  }
});

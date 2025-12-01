import { Router } from "express";
import * as analyticsController from "../controllers/analyticsController";

const router = Router();

/**
 * @swagger
 * /analytics/ab-variant:
 *   get:
 *     tags: [Analytics]
 *     summary: Get A/B test variant for current user
 *     description: Returns the A/B test variant assigned to the current user for profile completion experiments
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A/B test variant information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variant:
 *                   type: string
 *                   enum: [control, higher_bonus, multi_step, text_benefits]
 *                   example: higher_bonus
 *                 userId:
 *                   type: string
 *                   example: user_123abc
 *                 assignedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *       401:
 *         description: Not authenticated
 */
router.get("/ab-variant", analyticsController.getABVariant);

/**
 * @swagger
 * /analytics/profile-event:
 *   post:
 *     tags: [Analytics]
 *     summary: Track profile-related event
 *     description: Records user interactions and events during profile completion flow
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [profile_started, field_completed, validation_error, step_completed]
 *                 example: field_completed
 *               data:
 *                 type: object
 *                 properties:
 *                   field:
 *                     type: string
 *                     example: height
 *                   value:
 *                     type: string
 *                     example: "70"
 *                   step:
 *                     type: string
 *                     example: measurements
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 example: { "browser": "Chrome", "device": "desktop" }
 *     responses:
 *       200:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 eventId:
 *                   type: string
 *                   example: evt_456def
 *       400:
 *         description: Invalid event data
 *       401:
 *         description: Not authenticated
 */
router.post("/profile-event", analyticsController.trackProfileEvent);

/**
 * @swagger
 * /analytics/profile-abandonment:
 *   post:
 *     tags: [Analytics]
 *     summary: Track profile abandonment
 *     description: Records when users abandon the profile completion process
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [completionPercentage, timeSpent]
 *             properties:
 *               completionPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 45
 *               timeSpent:
 *                 type: number
 *                 minimum: 0
 *                 description: Time spent in seconds
 *                 example: 180
 *               lastField:
 *                 type: string
 *                 description: Last field the user interacted with before abandoning
 *                 example: weight
 *     responses:
 *       200:
 *         description: Abandonment event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 eventId:
 *                   type: string
 *                   example: abn_789ghi
 *       400:
 *         description: Invalid abandonment data
 *       401:
 *         description: Not authenticated
 */
router.post("/profile-abandonment", analyticsController.trackProfileAbandonment);

/**
 * @swagger
 * /analytics/profile:
 *   get:
 *     tags: [Analytics - Admin]
 *     summary: Get profile completion analytics
 *     description: Returns aggregated analytics data about profile completion rates and user behavior (admin only)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: Time period for analytics data
 *         example: month
 *       - in: query
 *         name: variant
 *         schema:
 *           type: string
 *           enum: [control, higher_bonus, multi_step, text_benefits]
 *         description: Filter by A/B test variant
 *     responses:
 *       200:
 *         description: Profile completion analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 completionRate:
 *                   type: number
 *                   example: 68.5
 *                 averageCompletionTime:
 *                   type: number
 *                   example: 420
 *                 abandonmentPoints:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                   example: { "height": 15, "weight": 12, "measurements": 8 }
 *                 variantPerformance:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                   example: { "control": { "completionRate": 60 }, "higher_bonus": { "completionRate": 75 } }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get("/profile", analyticsController.getProfileAnalytics);

/**
 * @swagger
 * /analytics/ab-test-results:
 *   get:
 *     tags: [Analytics - Admin]
 *     summary: Get A/B test performance results
 *     description: Returns detailed A/B test performance metrics and statistical significance (admin only)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: testName
 *         schema:
 *           type: string
 *         description: Specific A/B test to analyze
 *         example: profile_completion_bonus
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analysis period
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analysis period
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: A/B test performance results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 testName:
 *                   type: string
 *                   example: profile_completion_bonus
 *                 variants:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       participants:
 *                         type: number
 *                         example: 1250
 *                       conversions:
 *                         type: number
 *                         example: 850
 *                       conversionRate:
 *                         type: number
 *                         example: 68.0
 *                 statisticalSignificance:
 *                   type: number
 *                   example: 95.8
 *                 winner:
 *                   type: string
 *                   example: higher_bonus
 *                 improvement:
 *                   type: number
 *                   example: 12.5
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get("/ab-test-results", analyticsController.getABTestResults);

export default router;
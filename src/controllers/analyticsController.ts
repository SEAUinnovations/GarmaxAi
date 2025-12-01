import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { profileAnalyticsService } from "../services/profileAnalyticsService";

/**
 * @description Get A/B test variant for user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getABVariant(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const variant = await profileAnalyticsService.getABVariant(userId);
    
    res.status(200).json({
      variant
    });
  } catch (error) {
    logger.error(`Get A/B variant error: ${error}`, "analyticsController");
    res.status(500).json({ error: "Failed to get A/B variant" });
  }
}

/**
 * @description Track profile-related event
 * @param req - Express request object
 * @param res - Express response object
 */
export async function trackProfileEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { eventType, eventData } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!eventType) {
      res.status(400).json({ error: "Event type is required" });
      return;
    }

    await profileAnalyticsService.trackEvent({
      userId,
      eventType,
      eventData: eventData || {},
      timestamp: new Date()
    });
    
    res.status(200).json({
      message: "Event tracked successfully"
    });
  } catch (error) {
    logger.error(`Track profile event error: ${error}`, "analyticsController");
    res.status(500).json({ error: "Failed to track event" });
  }
}

/**
 * @description Get profile analytics dashboard data
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getProfileAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { days } = req.query;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // TODO: Add admin role check for analytics access
    // if (!req.user?.isAdmin) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const analytics = await profileAnalyticsService.getAnalytics(
      days ? parseInt(days as string) : 30
    );
    
    res.status(200).json({
      analytics
    });
  } catch (error) {
    logger.error(`Get profile analytics error: ${error}`, "analyticsController");
    res.status(500).json({ error: "Failed to get analytics" });
  }
}

/**
 * @description Track profile abandonment
 * @param req - Express request object
 * @param res - Express response object
 */
export async function trackProfileAbandonment(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { step, completionPercentage } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!step) {
      res.status(400).json({ error: "Abandonment step is required" });
      return;
    }

    await profileAnalyticsService.trackProfileAbandonment(userId, step, completionPercentage);
    
    res.status(200).json({
      message: "Abandonment tracked successfully"
    });
  } catch (error) {
    logger.error(`Track profile abandonment error: ${error}`, "analyticsController");
    res.status(500).json({ error: "Failed to track abandonment" });
  }
}

/**
 * @description Get A/B test performance results
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getABTestResults(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { days } = req.query;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // TODO: Add admin role check
    // if (!req.user?.isAdmin) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const analytics = await profileAnalyticsService.getAnalytics(
      days ? parseInt(days as string) : 30
    );
    
    res.status(200).json({
      abTestResults: analytics.abTestResults,
      totalUsers: analytics.totalUsers,
      completionRate: analytics.completionRate
    });
  } catch (error) {
    logger.error(`Get A/B test results error: ${error}`, "analyticsController");
    res.status(500).json({ error: "Failed to get A/B test results" });
  }
}
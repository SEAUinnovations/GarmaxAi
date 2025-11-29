import { Response } from "express";
import { storage } from "../storage";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";

/**
 * @description Get user profile
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await storage.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    logger.error(`Get profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

/**
 * @description Update user profile
 * @param req - Express request object
 * @param res - Express response object
 */
export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { username } = req.body as { username: string };

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    // In production, add database update logic
    res.status(200).json({
      message: "Profile updated successfully",
      user: { id: userId, username },
    });
  } catch (error) {
    logger.error(`Update profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to update profile" });
  }
}

/**
 * @description Get public user profile
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getPublicProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params as { userId: string };

    const user = await storage.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Return only public data
    res.status(200).json({
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    logger.error(`Get public profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

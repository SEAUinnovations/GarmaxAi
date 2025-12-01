import { Response } from "express";
import { storage } from "../storage";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { userProfileService, UserPhysicalProfile } from "../services/userProfileService";

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
    const { username, ...profileData } = req.body as { username?: string } & Partial<UserPhysicalProfile>;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Update username if provided
    if (username) {
      await storage.updateUser(userId, { username });
    }

    // Update physical profile if data provided
    if (Object.keys(profileData).length > 0) {
      const updatedProfile = await userProfileService.updateUserProfile(userId, profileData);
      
      const user = await storage.getUserById(userId);
      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: userId,
          username: user?.username,
          profileCompleted: updatedProfile.profileCompleted,
          profileCompletionPercentage: userProfileService.validateProfile(updatedProfile).completionPercentage
        },
        profile: updatedProfile
      });
      return;
    }

    const user = await storage.getUserById(userId);
    res.status(200).json({
      message: "Profile updated successfully",
      user: { id: userId, username: user?.username },
    });
  } catch (error) {
    logger.error(`Update profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to update profile" });
  }
}

/**
 * @description Get user's physical profile
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getPhysicalProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const profile = await userProfileService.getUserProfile(userId);
    const validation = userProfileService.validateProfile(profile || {});
    const benefits = userProfileService.getProfileBenefits(userId);
    
    res.status(200).json({
      profile,
      validation,
      benefits
    });
  } catch (error) {
    logger.error(`Get physical profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to fetch physical profile" });
  }
}

/**
 * @description Update user's physical profile
 * @param req - Express request object  
 * @param res - Express response object
 */
export async function updatePhysicalProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const profileData = req.body as Partial<UserPhysicalProfile>;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate the profile data
    const validation = userProfileService.validateProfile(profileData);
    if (!validation.isValid) {
      res.status(400).json({ 
        error: "Invalid profile data", 
        details: validation.errors 
      });
      return;
    }

    const updatedProfile = await userProfileService.updateUserProfile(userId, profileData);
    const newValidation = userProfileService.validateProfile(updatedProfile);
    
    res.status(200).json({
      message: "Physical profile updated successfully",
      profile: updatedProfile,
      validation: newValidation,
      completedNow: updatedProfile.profileCompleted && !req.body.profileCompleted // Just completed
    });
  } catch (error) {
    logger.error(`Update physical profile error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to update physical profile" });
  }
}

/**
 * @description Get profile completion benefits information
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getProfileBenefits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const benefits = userProfileService.getProfileBenefits(userId);
    
    res.status(200).json({ benefits });
  } catch (error) {
    logger.error(`Get profile benefits error: ${error}`, "userController");
    res.status(500).json({ error: "Failed to fetch profile benefits" });
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

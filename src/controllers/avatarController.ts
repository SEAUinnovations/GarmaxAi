import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { storage } from "../storage";
import { creditsService, AVATAR_CREATION_COST } from "../services/creditsService";
import { subscriptionService } from "../services/subscriptionService";
import { createAvatarSchema } from "@shared/schema";

/**
 * @description Get user's avatars
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getUserAvatars(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const avatars = await storage.getUserAvatars?.(userId);
    const limitInfo = await subscriptionService.canCreateAvatar(userId);

    res.status(200).json({
      avatars: avatars || [],
      currentCount: limitInfo.currentCount,
      limit: limitInfo.limit,
      canCreate: limitInfo.canCreate,
    });
  } catch (error) {
    logger.error(`Get avatars error: ${error}`, "AvatarController");
    res.status(500).json({ error: "Failed to fetch avatars" });
  }
}

/**
 * @description Create new avatar
 * @param req - Express request object
 * @param res - Express response object
 */
export async function createAvatar(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate request body
    const validatedData = createAvatarSchema.parse(req.body);
    const { rpmAvatarId, avatarGlbUrl, avatarThumbnailUrl } = validatedData;

    // Check if user can create avatar
    const limitInfo = await subscriptionService.canCreateAvatar(userId);
    
    if (!limitInfo.canCreate) {
      const subscription = await storage.getActiveSubscription?.(userId);
      const upgradeMessage = subscription
        ? "Avatar limit reached for your plan"
        : "Upgrade to Studio plan for 3 custom avatars";

      res.status(403).json({
        error: upgradeMessage,
        currentCount: limitInfo.currentCount,
        limit: limitInfo.limit,
      });
      return;
    }

    // Check if user has subscription or credits
    const hasActiveSubscription = await subscriptionService.hasTryonQuota(userId);
    
    if (!hasActiveSubscription) {
      // Deduct credits for avatar creation
      const hasCredits = await creditsService.hasCredits(userId, AVATAR_CREATION_COST);
      
      if (!hasCredits) {
        res.status(403).json({
          error: `Insufficient credits. ${AVATAR_CREATION_COST} credits required to create custom avatar.`,
          required: AVATAR_CREATION_COST,
        });
        return;
      }

      await creditsService.deductAvatarCreationCredits(userId);
    }

    // Create avatar
    const avatar = await storage.createUserAvatar?.({
      userId,
      rpmAvatarId,
      avatarGlbUrl,
      avatarThumbnailUrl: avatarThumbnailUrl || null,
      isDemo: false,
    });

    res.status(201).json({
      avatar,
      creditsDeducted: hasActiveSubscription ? 0 : AVATAR_CREATION_COST,
    });

    logger.info(`Avatar created for user ${userId}`, "AvatarController");
  } catch (error) {
    logger.error(`Create avatar error: ${error}`, "AvatarController");
    res.status(500).json({ error: "Failed to create avatar" });
  }
}

/**
 * @description Delete avatar
 * @param req - Express request object
 * @param res - Express response object
 */
export async function deleteAvatar(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { avatarId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const avatar = await storage.getUserAvatar?.(avatarId);
    
    if (!avatar || avatar.userId !== userId) {
      res.status(404).json({ error: "Avatar not found" });
      return;
    }

    if (avatar.isDemo) {
      res.status(403).json({ error: "Cannot delete demo avatar" });
      return;
    }

    await storage.deleteUserAvatar?.(avatarId);

    res.status(200).json({ success: true });

    logger.info(`Avatar ${avatarId} deleted by user ${userId}`, "AvatarController");
  } catch (error) {
    logger.error(`Delete avatar error: ${error}`, "AvatarController");
    res.status(500).json({ error: "Failed to delete avatar" });
  }
}

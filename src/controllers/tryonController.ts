import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { storage } from "../storage";
import { creditsService } from "../services/creditsService";
import { subscriptionService } from "../services/subscriptionService";
import { eventBridgeService } from "../services/eventBridgeService";
import { 
  createTryonSessionSchema, 
  confirmPreviewSchema
} from "@shared/schema";
import { type RenderQuality } from "../services/creditsService";

/**
 * @description Create new try-on session
 * @param req - Express request object
 * @param res - Express response object
 */
export async function createTryonSession(
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
    const validatedData = createTryonSessionSchema.parse(req.body);
    const { avatarId, garmentIds, renderQuality, backgroundScene, customBackgroundPrompt } = validatedData;

    // Check if user has quota or credits
    const hasQuota = await subscriptionService.hasTryonQuota(userId);
    const renderCost = creditsService.getTryonRenderCost(renderQuality as RenderQuality);
    const hasCredits = await creditsService.hasCredits(userId, renderCost);

    if (!hasQuota && !hasCredits) {
      res.status(403).json({
        error: "Insufficient credits or quota",
        required: renderCost,
      });
      return;
    }

    // Verify avatar ownership
    const avatar = await storage.getUserAvatar?.(avatarId);
    if (!avatar || avatar.userId !== userId) {
      res.status(404).json({ error: "Avatar not found" });
      return;
    }

    // Fetch garment details
    const garments = await storage.getGarmentsByIds?.(garmentIds);
    if (!garments || garments.length !== garmentIds.length) {
      res.status(400).json({ error: "Some garments not found" });
      return;
    }

    // Separate garments into overlayable and prompt-based
    const overlayGarmentIds = garments
      .filter((g) => g.isOverlayable)
      .map((g) => g.id);
    const promptGarmentIds = garments
      .filter((g) => !g.isOverlayable)
      .map((g) => g.id);

    // Deduct credits or increment quota
    let usedQuota = false;
    let creditsDeducted = 0;

    if (hasQuota) {
      await subscriptionService.incrementTryonQuota(userId);
      usedQuota = true;
    } else {
      creditsDeducted = await creditsService.deductTryonCredits(userId, renderQuality as RenderQuality);
    }

    // Create session
    const session = await storage.createTryonSession?.({
      userId,
      avatarId,
      garmentIds,
      overlayGarmentIds,
      promptGarmentIds,
      renderQuality,
      backgroundScene,
      customBackgroundPrompt,
      status: "queued",
      progress: 0,
      creditsUsed: creditsDeducted,
      usedQuota,
    });

    if (!session) {
      res.status(500).json({ error: "Failed to create session" });
      return;
    }

    // Publish EventBridge event for async SMPL processing
    await eventBridgeService.publishTryonEvent(session);

    res.status(201).json({
      sessionId: session.id,
      status: "queued",
      estimatedTime: 90,
      creditsDeducted,
      usedQuota,
    });

    logger.info(`Try-on session created: ${session.id}`, "TryonController");
  } catch (error) {
    logger.error(`Create try-on session error: ${error}`, "TryonController");
    res.status(500).json({ error: "Failed to create try-on session" });
  }
}

/**
 * @description Get try-on session details
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getTryonSession(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const session = await storage.getTryonSession?.(sessionId);
    if (!session || session.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.status(200).json({ session });
  } catch (error) {
    logger.error(`Get try-on session error: ${error}`, "TryonController");
    res.status(500).json({ error: "Failed to fetch session" });
  }
}

/**
 * @description Get user's try-on sessions
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getUserTryonSessions(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const sessions = await storage.getUserTryonSessions?.(userId, limit);

    res.status(200).json({
      sessions: sessions || [],
      total: sessions?.length || 0,
    });
  } catch (error) {
    logger.error(`Get user sessions error: ${error}`, "TryonController");
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

/**
 * @description Confirm preview (approve overlay or switch to prompt mode)
 * @param req - Express request object
 * @param res - Express response object
 */
export async function confirmPreview(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const validatedData = confirmPreviewSchema.parse(req.body);
    const { approveOverlay } = validatedData;

    const session = await storage.getTryonSession?.(sessionId);
    if (!session || session.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "preview_ready") {
      res.status(400).json({ error: "Session not in preview state" });
      return;
    }

    let refundedCredits = 0;

    if (!approveOverlay) {
      // User rejected overlay, switch to full prompt mode
      // Move overlay garments to prompt garments
      const updatedPromptGarments = [
        ...session.promptGarmentIds,
        ...session.overlayGarmentIds,
      ];

      await storage.updateTryonSession?.(sessionId, {
        overlayGarmentIds: [],
        promptGarmentIds: updatedPromptGarments,
        status: "awaiting_confirmation",
      });

      // Refund 50% of credits
      if (session.creditsUsed > 0) {
        refundedCredits = await creditsService.refundSession(sessionId, 0.5);
      }

      logger.info(
        `Session ${sessionId} switched to prompt mode, refunded ${refundedCredits} credits`,
        "TryonController"
      );
    } else {
      // User approved overlay, proceed to AI rendering
      await storage.updateTryonSession?.(sessionId, {
        status: "awaiting_confirmation",
      });
      
      // Publish EventBridge event for AI rendering
      await eventBridgeService.publishRenderEvent(session);
    }

    res.status(200).json({
      success: true,
      approvedOverlay: approveOverlay,
      refundedCredits,
    });
  } catch (error) {
    logger.error(`Confirm preview error: ${error}`, "TryonController");
    res.status(500).json({ error: "Failed to confirm preview" });
  }
}

/**
 * @description Cancel try-on session
 * @param req - Express request object
 * @param res - Express response object
 */
export async function cancelTryonSession(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const session = await storage.getTryonSession?.(sessionId);
    if (!session || session.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status === "completed") {
      res.status(400).json({ error: "Cannot cancel completed session" });
      return;
    }

    // Full refund if not yet rendering
    let refundedCredits = 0;
    const canRefund = !["rendering_ai", "completed"].includes(session.status);

    if (canRefund && session.creditsUsed > 0) {
      refundedCredits = await creditsService.refundSession(sessionId, 1.0);
    }

    await storage.updateTryonSession?.(sessionId, {
      status: "cancelled",
    });

    res.status(200).json({
      success: true,
      refundedCredits,
    });

    logger.info(
      `Session ${sessionId} cancelled, refunded ${refundedCredits} credits`,
      "TryonController"
    );
  } catch (error) {
    logger.error(`Cancel session error: ${error}`, "TryonController");
    res.status(500).json({ error: "Failed to cancel session" });
  }
}

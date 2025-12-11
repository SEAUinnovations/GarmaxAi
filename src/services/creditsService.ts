import { storage } from "../storage";
import { logger } from "../utils/winston-logger";

/**
 * Credits Service
 * Handles user credits and subscription management
 */

// Try-on render costs
export const TRYON_RENDER_COST_SD = 10;
export const TRYON_RENDER_COST_HD = 15;
export const TRYON_RENDER_COST_4K = 25;
export const AVATAR_CREATION_COST = 5;
export const OVERLAY_REFUND_PERCENT = 0.5;

export interface CreditInfo {
  userId: string;
  balance: number;
  used: number;
  available: number;
}

export type RenderQuality = "sd" | "hd" | "4k";

export class CreditsService {
  /**
   * Get user's credit balance
   */
  async getCredits(userId: string): Promise<CreditInfo> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      logger.info(`Fetching credits for user ${userId}`, "CreditsService");

      return {
        userId,
        balance: user.credits,
        used: 0,
        available: user.credits,
      };
    } catch (error) {
      logger.error(`Failed to fetch credits: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Deduct credits for a generation
   */
  async deductCredits(userId: string, amount: number): Promise<boolean> {
    try {
      if (amount <= 0) {
        throw new Error("Credit amount must be positive");
      }

      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      if (user.credits < amount) {
        throw new Error("Insufficient credits");
      }

      const updated = await storage.updateUserCredits(userId, user.credits - amount);

      logger.info(
        `Deducting ${amount} credits from user ${userId}. New balance: ${updated.credits}`,
        "CreditsService"
      );

      return true;
    } catch (error) {
      logger.error(`Failed to deduct credits: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Add credits to user account
   */
  async addCredits(userId: string, amount: number): Promise<boolean> {
    try {
      if (amount <= 0) {
        throw new Error("Credit amount must be positive");
      }

      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const updated = await storage.updateUserCredits(userId, user.credits + amount);

      logger.info(
        `Adding ${amount} credits to user ${userId}. New balance: ${updated.credits}`,
        "CreditsService"
      );

      return true;
    } catch (error) {
      logger.error(`Failed to add credits: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Check if user has sufficient credits
   */
  async hasCredits(userId: string, required: number): Promise<boolean> {
    try {
      const credits = await this.getCredits(userId);
      return credits.available >= required;
    } catch (error) {
      logger.error(`Failed to check credits: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Award free trial credits to new user
   */
  async awardTrialCredits(userId: string): Promise<boolean> {
    const TRIAL_CREDITS = 10;
    return this.addCredits(userId, TRIAL_CREDITS);
  }

  /**
   * Calculate try-on render cost based on quality
   */
  getTryonRenderCost(quality: RenderQuality): number {
    switch (quality) {
      case "sd":
        return TRYON_RENDER_COST_SD;
      case "hd":
        return TRYON_RENDER_COST_HD;
      case "4k":
        return TRYON_RENDER_COST_4K;
      default:
        return TRYON_RENDER_COST_SD;
    }
  }

  /**
   * Deduct credits for try-on render
   */
  async deductTryonCredits(userId: string, quality: RenderQuality): Promise<number> {
    const cost = this.getTryonRenderCost(quality);
    await this.deductCredits(userId, cost);
    logger.info(
      `Deducted ${cost} credits for ${quality} try-on render from user ${userId}`,
      "CreditsService"
    );
    return cost;
  }

  /**
   * Refund credits for session cancellation or overlay fallback
   */
  async refundSession(sessionId: string, refundPercent: number): Promise<number> {
    try {
      // Get the session from storage
      const session = await storage.getTryonSession(sessionId);
      
      if (!session) {
        logger.warn(`Session ${sessionId} not found for refund`, "CreditsService");
        return 0;
      }

      // Only refund for failed or error states (automatic refunds for failed renders)
      if (session.status !== 'failed' && session.status !== 'error') {
        logger.info(
          `Session ${sessionId} status is ${session.status}, no automatic refund`,
          "CreditsService"
        );
        return 0;
      }

      // Check if session used credits (not quota)
      if (session.usedQuota || session.creditsUsed === 0) {
        logger.info(
          `Session ${sessionId} used quota or no credits, no refund needed`,
          "CreditsService"
        );
        return 0;
      }

      // Check if already refunded
      if (session.refundedCredits > 0) {
        logger.warn(
          `Session ${sessionId} already has ${session.refundedCredits} credits refunded`,
          "CreditsService"
        );
        return 0;
      }

      // Calculate refund amount
      const refundAmount = Math.floor(session.creditsUsed * refundPercent);
      
      if (refundAmount <= 0) {
        return 0;
      }

      // Add credits back to user
      await this.addCredits(session.userId, refundAmount);

      // Update session with refunded amount
      await storage.updateTryonSession(sessionId, {
        refundedCredits: refundAmount,
      });

      logger.info(
        `Refunded ${refundAmount} credits (${refundPercent * 100}%) for session ${sessionId}, user ${session.userId}`,
        "CreditsService"
      );

      return refundAmount;
    } catch (error) {
      logger.error(`Failed to refund session: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Automatic refund for failed renders
   * Refunds 100% of credits when SMPL processing or rendering fails
   */
  async refundFailedSession(sessionId: string, failureReason: string): Promise<number> {
    try {
      const session = await storage.getTryonSession(sessionId);
      
      if (!session) {
        logger.warn(`Session ${sessionId} not found for failure refund`, "CreditsService");
        return 0;
      }

      // Only refund if status indicates failure
      if (session.status !== "failed") {
        logger.warn(
          `Session ${sessionId} status is ${session.status}, not eligible for failure refund`,
          "CreditsService"
        );
        return 0;
      }

      const refundAmount = await this.refundSession(sessionId, 1.0); // 100% refund

      logger.info(
        `Automatic failure refund: ${refundAmount} credits for session ${sessionId}. Reason: ${failureReason}`,
        "CreditsService"
      );

      return refundAmount;
    } catch (error) {
      logger.error(`Failed to process automatic refund: ${error}`, "CreditsService");
      throw error;
    }
  }

  /**
   * Deduct credits for avatar creation
   */
  async deductAvatarCreationCredits(userId: string): Promise<void> {
    await this.deductCredits(userId, AVATAR_CREATION_COST);
    logger.info(
      `Deducted ${AVATAR_CREATION_COST} credits for avatar creation from user ${userId}`,
      "CreditsService"
    );
  }
}

export const creditsService = new CreditsService();

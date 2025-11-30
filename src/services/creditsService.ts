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
      const session = await storage.getTryonSession?.(sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      if (session.creditsUsed === 0) {
        return 0; // No credits to refund
      }

      const refundAmount = Math.floor(session.creditsUsed * refundPercent);
      await this.addCredits(session.userId, refundAmount);
      await storage.updateSessionRefund?.(sessionId, refundAmount);

      logger.info(
        `Refunded ${refundAmount} credits (${refundPercent * 100}%) for session ${sessionId}`,
        "CreditsService"
      );

      return refundAmount;
    } catch (error) {
      logger.error(`Failed to refund session: ${error}`, "CreditsService");
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

import { storage } from "../storage";
import { logger } from "../utils/winston-logger";

/**
 * Credits Service
 * Handles user credits and subscription management
 */

export interface CreditInfo {
  userId: string;
  balance: number;
  used: number;
  available: number;
}

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
}

export const creditsService = new CreditsService();

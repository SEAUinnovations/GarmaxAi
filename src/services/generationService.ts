import { storage } from "../storage";
import { type Generation, type InsertGeneration } from "@shared/schema";
import { logger } from "../utils/winston-logger";

/**
 * Generation Service
 * Handles AI image generation requests and management
 */

export interface GenerationRequest {
  prompt: string;
  style: "portrait" | "fashion" | "editorial" | "commercial";
  quality?: "low" | "medium" | "high";
  userId: string;
}

export interface GenerationResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  creditsUsed: number;
  createdAt: string;
}

export class GenerationService {
  /**
   * Create a new generation request
   */
  async createGeneration(request: GenerationRequest): Promise<Generation> {
    try {
      const creditsRequired = this.calculateCredits(request.quality || "medium");

      const insertGeneration: InsertGeneration = {
        userId: request.userId,
        prompt: request.prompt,
        style: request.style,
        quality: request.quality || "medium",
        status: "pending",
        creditsUsed: creditsRequired,
      };

      const generation = await storage.createGeneration(insertGeneration);

      logger.info(
        `Generation created ${generation.id} for user ${request.userId}: "${request.prompt}"`,
        "GenerationService"
      );

      return generation;
    } catch (error) {
      logger.error(`Failed to create generation: ${error}`, "GenerationService");
      throw error;
    }
  }

  /**
   * Get generation by ID
   */
  async getGeneration(id: string): Promise<Generation | null> {
    try {
      logger.info(`Fetching generation ${id}`, "GenerationService");
      const generation = await storage.getGeneration(id);
      return generation || null;
    } catch (error) {
      logger.error(`Failed to fetch generation: ${error}`, "GenerationService");
      throw error;
    }
  }

  /**
   * Get user's generations
   */
  async getUserGenerations(userId: string, limit = 20): Promise<Generation[]> {
    try {
      logger.info(`Fetching generations for user ${userId}`, "GenerationService");
      const generations = await storage.getUserGenerations(userId);
      return generations.slice(0, limit);
    } catch (error) {
      logger.error(`Failed to fetch user generations: ${error}`, "GenerationService");
      throw error;
    }
  }

  /**
   * Cancel a generation request
   */
  async cancelGeneration(id: string, userId: string): Promise<boolean> {
    try {
      const generation = await storage.getGeneration(id);
      
      if (!generation) {
        return false;
      }

      // Verify ownership
      if (generation.userId !== userId) {
        throw new Error("Unauthorized: Generation does not belong to user");
      }

      const success = await storage.cancelGeneration(id);
      
      logger.info(
        `Cancelled generation ${id} for user ${userId}`,
        "GenerationService"
      );

      return success;
    } catch (error) {
      logger.error(`Failed to cancel generation: ${error}`, "GenerationService");
      throw error;
    }
  }

  /**
   * Calculate credits needed based on quality
   */
  private calculateCredits(quality: string): number {
    const creditMap: Record<string, number> = {
      low: 1,
      medium: 3,
      high: 5,
    };
    return creditMap[quality] || 3;
  }
}

export const generationService = new GenerationService();

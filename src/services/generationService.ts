import { storage } from "../storage";
import { type Generation, type InsertGeneration } from "@shared/schema";
import { logger } from "../utils/winston-logger";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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

      // Start async image generation
      this.processGeneration(generation.id, request).catch((error: any) => {
        logger.error(`Failed to process generation ${generation.id}: ${error}`, "GenerationService");
      });

      return generation;
    } catch (error) {
      logger.error(`Failed to create generation: ${error}`, "GenerationService");
      throw error;
    }
  }

  /**
   * Process generation with FLUX.1-dev
   */
  private async processGeneration(generationId: string, request: GenerationRequest): Promise<void> {
    try {
      logger.info(`Starting image generation for ${generationId}`, "GenerationService");

      // Update status to processing
      await this.updateGenerationStatus(generationId, "processing");

      // Enhanced prompt based on style
      const enhancedPrompt = this.enhancePrompt(request.prompt, request.style);

      // Generate image with FLUX.1-dev (best for consistent fashion models)
      const output = await replicate.run("black-forest-labs/flux-dev", {
        input: {
          prompt: enhancedPrompt,
          num_inference_steps: this.getInferenceSteps(request.quality || "medium"),
          guidance_scale: 3.5, // FLUX.1 works best with lower guidance
          width: 1024,
          height: 1024,
          num_outputs: 1,
        },
      }) as string[];

      const imageUrl = Array.isArray(output) ? output[0] : output;

      if (!imageUrl) {
        throw new Error("No image URL returned from FLUX.1-dev");
      }

      // Update generation with result
      await this.updateGenerationResult(generationId, imageUrl);

      logger.info(`Generation completed successfully: ${generationId}`, "GenerationService");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Generation failed for ${generationId}: ${errorMessage}`, "GenerationService");
      await this.updateGenerationStatus(generationId, "failed", errorMessage);
    }
  }

  /**
   * Update generation status
   */
  private async updateGenerationStatus(generationId: string, status: "processing" | "completed" | "failed", errorMessage?: string): Promise<void> {
    await storage.updateGenerationStatus(generationId, status, errorMessage);
    logger.info(`Updated generation ${generationId} status to ${status}`, "GenerationService");
  }

  /**
   * Update generation with result
   */
  private async updateGenerationResult(generationId: string, imageUrl: string): Promise<void> {
    await storage.updateGenerationResult(generationId, imageUrl);
    logger.info(`Updated generation ${generationId} with image URL`, "GenerationService");
  }

  /**
   * Enhance prompt based on style
   */
  private enhancePrompt(prompt: string, style: string): string {
    const stylePrompts = {
      portrait: "professional portrait photography, high quality, detailed face, studio lighting",
      fashion: "fashion photography, runway style, professional lighting, haute couture",
      editorial: "editorial photography, artistic composition, dramatic lighting, magazine quality",
      commercial: "commercial photography, product focused, clean background, professional",
      street: "street style photography, urban fashion, natural lighting, candid",
      candid: "candid photography, natural moments, authentic, lifestyle"
    };

    const styleEnhancement = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.portrait;
    return `${prompt}, ${styleEnhancement}, 4K, high resolution, masterpiece`;
  }

  /**
   * Get inference steps based on quality
   * FLUX.1-dev optimal steps: 20-50
   */
  private getInferenceSteps(quality: string): number {
    const stepsMap: Record<string, number> = {
      low: 20,    // Fast generation
      medium: 28, // Balanced (recommended)
      high: 40,   // Maximum quality
    };
    return stepsMap[quality] || 28;
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

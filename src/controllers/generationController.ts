import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { generationService } from "../services/generationService";
import { creditsService } from "../services/creditsService";
import { logger } from "../utils/winston-logger";
import { generationSchema } from "@shared/schema";

/**
 * @description Create a new image generation
 * @param req - Express request object with user context
 * @param res - Express response object
 */
export async function createGeneration(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate request body
    const parsed = generationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid generation parameters", details: parsed.error.errors });
      return;
    }

    const { prompt, style, quality = "medium" } = parsed.data;

    // Check credits
    const creditRequired = quality === "high" ? 5 : quality === "medium" ? 3 : 1;
    const hasCredits = await creditsService.hasCredits(userId, creditRequired);

    if (!hasCredits) {
      res.status(402).json({ error: "Insufficient credits" });
      return;
    }

    // Create generation request
    const generation = await generationService.createGeneration({
      prompt,
      style,
      quality: quality as "low" | "medium" | "high",
      userId,
    });

    // Deduct credits
    await creditsService.deductCredits(userId, creditRequired);

    logger.info(`Generation created: ${generation.id}`, "generationController");

    res.status(201).json({
      id: generation.id,
      status: generation.status,
      message: "Generation request created",
    });
  } catch (error) {
    logger.error(`Generate image error: ${error}`, "generationController");
    res.status(500).json({ error: "Failed to create generation" });
  }
}

/**
 * @description Get a specific generation
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getGeneration(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const generation = await generationService.getGeneration(id);

    if (!generation) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }

    // Verify generation belongs to user
    if (generation.userId !== userId) {
      res.status(403).json({ error: "Forbidden: Generation does not belong to user" });
      return;
    }

    res.status(200).json({ generation });
  } catch (error) {
    logger.error(`Get generation error: ${error}`, "generationController");
    res.status(500).json({ error: "Failed to fetch generation" });
  }
}

/**
 * @description Get user's generations
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getGenerations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const generations = await generationService.getUserGenerations(userId, limit);

    res.status(200).json({
      generations,
      total: generations.length,
    });
  } catch (error) {
    logger.error(`Get generations error: ${error}`, "generationController");
    res.status(500).json({ error: "Failed to fetch generations" });
  }
}

/**
 * @description Cancel a generation
 * @param req - Express request object
 * @param res - Express response object
 */
export async function cancelGeneration(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const success = await generationService.cancelGeneration(id, userId);

    if (!success) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }

    res.status(200).json({ message: "Generation cancelled successfully" });
  } catch (error) {
    logger.error(`Cancel generation error: ${error}`, "generationController");
    res.status(500).json({ error: "Failed to cancel generation" });
  }
}

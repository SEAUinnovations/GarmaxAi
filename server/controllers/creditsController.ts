import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { creditsService } from "../services/creditsService";
import { logger } from "../utils/winston-logger";

/**
 * @description Get user's credit balance
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const credits = await creditsService.getCredits(userId);

    res.status(200).json({
      credits,
    });
  } catch (error) {
    logger.error(`Get credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to fetch credits" });
  }
}

/**
 * @description Add credits to account (admin or payment endpoint)
 * @param req - Express request object
 * @param res - Express response object
 */
export async function addCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "Invalid credit amount" });
      return;
    }

    // TODO: Verify payment or admin status
    await creditsService.addCredits(userId, amount);

    const credits = await creditsService.getCredits(userId);

    logger.info(`Added ${amount} credits to user ${userId}`, "creditsController");

    res.status(200).json({
      message: "Credits added successfully",
      credits,
    });
  } catch (error) {
    logger.error(`Add credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to add credits" });
  }
}

/**
 * @description Check credit status
 * @param req - Express request object
 * @param res - Express response object
 */
export async function checkCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { required } = req.query;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requiredCredits = required ? parseInt(required as string) : 1;

    if (isNaN(requiredCredits) || requiredCredits < 1) {
      res.status(400).json({ error: "Invalid required amount" });
      return;
    }

    const hasCredits = await creditsService.hasCredits(userId, requiredCredits);
    const userCredits = await creditsService.getCredits(userId);

    res.status(200).json({
      hasCredits,
      required: requiredCredits,
      available: userCredits.available,
    });
  } catch (error) {
    logger.error(`Check credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to check credits" });
  }
}

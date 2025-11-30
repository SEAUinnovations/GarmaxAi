import { Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { storage } from "../storage";
import { garmentAnalysisService } from "../services/garmentAnalysisService";
import { uploadGarmentSchema } from "@shared/schema";
import { nanoid } from "nanoid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME = process.env.S3_BUCKET || "user-uploads";

/**
 * @description Upload and analyze garment image
 * @param req - Express request object with file
 * @param res - Express response object
 */
export async function uploadGarment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const { name, type } = uploadGarmentSchema.parse(req.body);

    // Analyze garment
    const analysis = await garmentAnalysisService.analyzeGarment(req.file.buffer);

    // Upload to S3
    const fileExtension = req.file.originalname.split(".").pop() || "jpg";
    const s3Key = `garments/${userId}/${nanoid()}.${fileExtension}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(uploadCommand);

    const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

    // Save garment to database
    const garment = await storage.createGarment?.({
      userId,
      name: name || analysis.type,
      imageUrl,
      s3Key,
      type: type || analysis.type,
      color: analysis.color,
      pattern: analysis.pattern || null,
      brand: analysis.brand || null,
      isOverlayable: analysis.isOverlayable,
      overlayConfidence: analysis.confidence.toString(),
      analysisData: JSON.stringify(analysis),
    });

    // Add to wardrobe
    if (garment) {
      await storage.addToWardrobe?.(userId, garment.id);
    }

    res.status(201).json({
      garment,
      analysis: {
        type: analysis.type,
        color: analysis.color,
        isOverlayable: analysis.isOverlayable,
        confidence: analysis.confidence,
        reason: analysis.reason,
      },
    });

    logger.info(`Garment uploaded for user ${userId}`, "GarmentController");
  } catch (error) {
    logger.error(`Upload garment error: ${error}`, "GarmentController");
    res.status(500).json({ error: "Failed to upload garment" });
  }
}

/**
 * @description Analyze garment from URL
 * @param req - Express request object
 * @param res - Express response object
 */
export async function analyzeGarmentUrl(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { url, name, type } = req.body;

    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    // Fetch image from URL
    const response = await fetch(url);
    if (!response.ok) {
      res.status(400).json({ error: "Failed to fetch image from URL" });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Analyze garment
    const analysis = await garmentAnalysisService.analyzeGarment(buffer);

    // Upload to S3
    const s3Key = `garments/${userId}/${nanoid()}.jpg`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: "image/jpeg",
    });

    await s3Client.send(uploadCommand);

    const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

    // Save garment to database
    const garment = await storage.createGarment?.({
      userId,
      name: name || analysis.type,
      imageUrl,
      s3Key,
      type: type || analysis.type,
      color: analysis.color,
      pattern: analysis.pattern || null,
      brand: analysis.brand || null,
      isOverlayable: analysis.isOverlayable,
      overlayConfidence: analysis.confidence.toString(),
      analysisData: JSON.stringify(analysis),
    });

    // Add to wardrobe
    if (garment) {
      await storage.addToWardrobe?.(userId, garment.id);
    }

    res.status(201).json({
      garment,
      analysis: {
        type: analysis.type,
        color: analysis.color,
        isOverlayable: analysis.isOverlayable,
        confidence: analysis.confidence,
        reason: analysis.reason,
      },
    });

    logger.info(`Garment analyzed from URL for user ${userId}`, "GarmentController");
  } catch (error) {
    logger.error(`Analyze garment URL error: ${error}`, "GarmentController");
    res.status(500).json({ error: "Failed to analyze garment" });
  }
}

/**
 * @description Get user's wardrobe
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getUserWardrobe(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const garments = await storage.getUserWardrobe?.(userId);

    res.status(200).json({
      garments: garments || [],
      total: garments?.length || 0,
    });
  } catch (error) {
    logger.error(`Get wardrobe error: ${error}`, "GarmentController");
    res.status(500).json({ error: "Failed to fetch wardrobe" });
  }
}

/**
 * @description Update garment (e.g., toggle overlay mode)
 * @param req - Express request object
 * @param res - Express response object
 */
export async function updateGarment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { garmentId } = req.params;
    const { isOverlayable } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const garment = await storage.getGarment?.(garmentId);
    
    if (!garment || garment.userId !== userId) {
      res.status(404).json({ error: "Garment not found" });
      return;
    }

    if (typeof isOverlayable === "boolean") {
      await storage.updateGarment?.(garmentId, { isOverlayable });
    }

    const updated = await storage.getGarment?.(garmentId);

    res.status(200).json({ garment: updated });

    logger.info(`Garment ${garmentId} updated by user ${userId}`, "GarmentController");
  } catch (error) {
    logger.error(`Update garment error: ${error}`, "GarmentController");
    res.status(500).json({ error: "Failed to update garment" });
  }
}

/**
 * @description Delete garment from wardrobe
 * @param req - Express request object
 * @param res - Express response object
 */
export async function deleteGarment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { garmentId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const garment = await storage.getGarment?.(garmentId);
    
    if (!garment || garment.userId !== userId) {
      res.status(404).json({ error: "Garment not found" });
      return;
    }

    await storage.deleteGarment?.(garmentId);

    res.status(200).json({ success: true });

    logger.info(`Garment ${garmentId} deleted by user ${userId}`, "GarmentController");
  } catch (error) {
    logger.error(`Delete garment error: ${error}`, "GarmentController");
    res.status(500).json({ error: "Failed to delete garment" });
  }
}

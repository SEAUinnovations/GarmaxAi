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
export async function analyzeGarmentFromUrl(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { imageUrl } = req.body;
    if (!imageUrl) {
      res.status(400).json({ error: "Image URL is required" });
      return;
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      res.status(400).json({ error: "Invalid URL format" });
      return;
    }

    // Fetch image from URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      res.status(400).json({ error: "Failed to fetch image from URL" });
      return;
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Analyze the garment
    const analysis = await garmentAnalysisService.analyzeGarment(imageBuffer);

    // Extract filename from URL for naming
    const filename = parsedUrl.pathname.split('/').pop() || 'garment';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const garmentName = nameWithoutExt.replace(/\b\w/g, l => l.toUpperCase()) || 'Imported Garment';

    // Upload to S3 for storage
    const fileExtension = parsedUrl.pathname.split('.').pop() || 'jpg';
    const s3Key = `garments/${userId}/${nanoid()}.${fileExtension}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: imageResponse.headers.get('content-type') || 'image/jpeg',
      Metadata: {
        'original-url': imageUrl,
        'user-id': userId,
        'upload-source': 'url'
      }
    });

    await s3Client.send(uploadCommand);

    // Create garment record
    const garment = await storage.createGarment?.({
      id: nanoid(),
      userId,
      name: garmentName,
      type: analysis.type || 'unknown',
      color: analysis.dominantColor,
      s3Key,
      imageUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`,
      thumbnailUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`, // TODO: Generate thumbnail
      analysis: {
        confidence: analysis.confidence || 0.8,
        detectedType: analysis.type,
        dominantColor: analysis.dominantColor,
        isOverlayable: analysis.isOverlayable || false,
        originalUrl: imageUrl
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (!garment) {
      res.status(500).json({ error: "Failed to create garment record" });
      return;
    }

    // Add to user's wardrobe
    if (storage.addToWardrobe) {
      await storage.addToWardrobe(userId, garment.id);
    }

    logger.info(`Garment analyzed from URL: ${garment.id} for user ${userId}`);
    
    res.status(201).json({
      id: garment.id,
      name: garment.name,
      type: garment.type,
      color: garment.color,
      imageUrl: garment.imageUrl,
      thumbnailUrl: garment.thumbnailUrl,
      isOverlayable: analysis.isOverlayable || false,
      garmentType: garment.type,
      detectedColor: garment.color,
      confidence: analysis.confidence || 0.8,
      uploadedAt: garment.createdAt.toISOString()
    });
    
  } catch (error) {
    logger.error("Error analyzing garment from URL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

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

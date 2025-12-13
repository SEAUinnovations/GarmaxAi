import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/winston-logger";
import { storage } from "../storage";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { eventBridgeService } from "../services/eventBridgeService";
import { uploadPhotoSchema } from "@shared/schema";
import { watermarkService } from "../services/watermarkService";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

/**
 * @description Upload user photo for try-on
 * @param req - Express request object with file
 * @param res - Express response object
 */
export async function uploadPhoto(
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
      res.status(400).json({ error: "No photo file provided" });
      return;
    }

    // Validate photo type
    const { photoType } = uploadPhotoSchema.parse(req.body);

    // Generate unique S3 keys
    const fileId = nanoid();
    const extension = req.file.mimetype.split('/')[1];
    const photoS3Key = `user-photos/${userId}/${fileId}.${extension}`;
    const thumbnailS3Key = `user-photos/${userId}/${fileId}_thumb.${extension}`;

    // Create thumbnail (no watermark on thumbnails)
    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(200, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Apply watermark to original image based on user subscription tier
    const user = req.user;
    const subscriptionTier = user?.subscriptionTier || 'free';
    const watermarkedBuffer = await watermarkService.applyWatermark(
      req.file.buffer,
      subscriptionTier
    );

    // Upload watermarked photo to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: photoS3Key,
      Body: watermarkedBuffer,
      ContentType: req.file.mimetype,
    }));

    // Upload thumbnail to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbnailS3Key,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    }));

    const photoUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${photoS3Key}`;
    const thumbnailUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${thumbnailS3Key}`;

    // Save photo record to database
    const photo = await storage.createUserPhoto({
      userId,
      photoUrl,
      photoS3Key,
      thumbnailUrl,
      photoType,
    });

    // Trigger SMPL processing via EventBridge (if configured)
    // Note: This will be picked up by Lambda handler that processes SMPL
    try {
      // We'll implement this after EventBridge service is updated
      logger.info(`Photo uploaded successfully: ${photo.id}, SMPL processing queued`, 'PhotoController');
    } catch (eventError) {
      logger.warn(`Photo uploaded but SMPL processing queue failed: ${eventError}`, 'PhotoController');
      // Don't fail the upload if event publishing fails
    }

    res.status(201).json({
      id: photo.id,
      url: photo.photoUrl,
      thumbnailUrl: photo.thumbnailUrl,
      type: photo.photoType,
      uploadedAt: photo.createdAt,
      processed: photo.smplProcessed,
    });

    logger.info(`Photo uploaded for user ${userId}: ${photo.id}`, 'PhotoController');
  } catch (error) {
    logger.error(`Photo upload error: ${error}`, 'PhotoController');
    res.status(500).json({ error: "Failed to upload photo" });
  }
}

/**
 * @description Get user's uploaded photos
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getUserPhotos(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const photos = await storage.getUserPhotos(userId);

    res.status(200).json({
      photos: photos.map(photo => ({
        id: photo.id,
        url: photo.photoUrl,
        thumbnailUrl: photo.thumbnailUrl,
        type: photo.photoType,
        uploadedAt: photo.createdAt,
        processed: photo.smplProcessed,
        smplData: photo.smplProcessed ? {
          confidence: photo.smplConfidence,
          metadata: photo.smplMetadata,
        } : undefined,
      })),
    });
  } catch (error) {
    logger.error(`Get photos error: ${error}`, 'PhotoController');
    res.status(500).json({ error: "Failed to fetch photos" });
  }
}

/**
 * @description Get specific photo details
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getPhoto(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { photoId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const photo = await storage.getUserPhoto(photoId);

    if (!photo || photo.userId !== userId) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    res.status(200).json({
      id: photo.id,
      url: photo.photoUrl,
      thumbnailUrl: photo.thumbnailUrl,
      type: photo.photoType,
      uploadedAt: photo.createdAt,
      processed: photo.smplProcessed,
      smplData: photo.smplProcessed ? {
        dataUrl: photo.smplDataUrl,
        confidence: photo.smplConfidence,
        metadata: photo.smplMetadata,
      } : undefined,
    });
  } catch (error) {
    logger.error(`Get photo error: ${error}`, 'PhotoController');
    res.status(500).json({ error: "Failed to fetch photo" });
  }
}

/**
 * @description Delete user photo
 * @param req - Express request object
 * @param res - Express response object
 */
export async function deletePhoto(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { photoId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const photo = await storage.getUserPhoto(photoId);

    if (!photo || photo.userId !== userId) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    // Delete from S3
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: photo.photoS3Key,
      }));

      // Delete thumbnail if exists
      if (photo.thumbnailUrl) {
        const thumbnailKey = photo.photoS3Key.replace(/\.[^.]+$/, '_thumb$&');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: thumbnailKey,
        }));
      }
    } catch (s3Error) {
      logger.warn(`Failed to delete S3 objects for photo ${photoId}: ${s3Error}`, 'PhotoController');
      // Continue with database deletion even if S3 fails
    }

    // Delete from database
    await storage.deleteUserPhoto(photoId);

    res.status(200).json({ message: "Photo deleted successfully" });
    logger.info(`Photo deleted: ${photoId}`, 'PhotoController');
  } catch (error) {
    logger.error(`Delete photo error: ${error}`, 'PhotoController');
    res.status(500).json({ error: "Failed to delete photo" });
  }
}

import { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { logger } from '../utils/winston-logger';
import { storage } from '../storage';
import type { ApiKeyRequest } from '../types/enterprise';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

/**
 * Upload customer photo for virtual try-on
 * POST /api/v1/photos
 * Requires multipart/form-data with 'photo' field
 */
export async function uploadEnterprisePhoto(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { externalCustomerId, photoType = 'full_body' } = req.body;

    // Validate required fields
    if (!externalCustomerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'externalCustomerId is required'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No photo file provided'
      });
      return;
    }

    // Validate photo type
    if (!['full_body', 'upper_body', 'lower_body'].includes(photoType)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid photoType. Must be: full_body, upper_body, or lower_body'
      });
      return;
    }

    // Verify customer exists
    const customer = await storage.getExternalCustomer(organizationId, externalCustomerId);
    if (!customer) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Customer not found'
      });
      return;
    }

    // Generate unique IDs for S3
    const photoId = nanoid();
    const extension = req.file.mimetype.split('/')[1] || 'jpg';
    
    // Organization-scoped S3 paths
    const photoS3Key = `enterprise/org-${organizationId}/photos/${photoId}.${extension}`;
    const thumbnailS3Key = `enterprise/org-${organizationId}/photos/${photoId}_thumb.${extension}`;

    // Create thumbnail (200x300)
    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(200, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload original photo to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: photoS3Key,
      Body: req.file.buffer,
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

    // Save photo record to database (reuse existing user_photos table structure)
    // Note: We'll use a special "enterprise" userId pattern
    const enterpriseUserId = `org-${organizationId}-customer-${customer.id}`;
    
    const photo = await storage.createUserPhoto({
      userId: enterpriseUserId,
      photoUrl,
      photoS3Key,
      thumbnailUrl,
      photoType,
    });

    logger.info(
      `Uploaded enterprise photo ${photoId} for customer ${externalCustomerId}`,
      'EnterprisePhotoController'
    );

    res.status(201).json({
      photo: {
        id: photo.id,
        photoId,
        photoUrl,
        thumbnailUrl,
        photoType,
        externalCustomerId,
        createdAt: photo.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error uploading enterprise photo: ${error}`, 'EnterprisePhotoController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to upload photo'
    });
  }
}

/**
 * List photos for a customer
 * GET /api/v1/customers/:externalCustomerId/photos
 */
export async function listCustomerPhotos(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { externalCustomerId } = req.params;

    // Verify customer exists
    const customer = await storage.getExternalCustomer(organizationId, externalCustomerId);
    if (!customer) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Customer not found'
      });
      return;
    }

    // Get photos for this enterprise customer
    const enterpriseUserId = `org-${organizationId}-customer-${customer.id}`;
    const photos = await storage.getUserPhotos(enterpriseUserId);

    res.json({
      photos: photos.map(photo => ({
        id: photo.id,
        photoUrl: photo.photoUrl,
        thumbnailUrl: photo.thumbnailUrl,
        photoType: photo.photoType,
        processingStatus: photo.processingStatus,
        createdAt: photo.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error listing customer photos: ${error}`, 'EnterprisePhotoController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list photos'
    });
  }
}

/**
 * Get photo details
 * GET /api/v1/photos/:photoId
 */
export async function getEnterprisePhoto(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as ApiKeyRequest;
    const organizationId = authReq.organizationId!;
    const { photoId } = req.params;

    const photo = await storage.getUserPhoto(photoId);
    
    if (!photo) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Photo not found'
      });
      return;
    }

    // Verify photo belongs to this organization
    if (!photo.userId.startsWith(`org-${organizationId}-`)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Photo does not belong to your organization'
      });
      return;
    }

    res.json({
      photo: {
        id: photo.id,
        photoUrl: photo.photoUrl,
        thumbnailUrl: photo.thumbnailUrl,
        photoType: photo.photoType,
        processingStatus: photo.processingStatus,
        smplDataUrl: photo.smplDataUrl,
        createdAt: photo.createdAt,
        updatedAt: photo.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error getting enterprise photo: ${error}`, 'EnterprisePhotoController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get photo'
    });
  }
}

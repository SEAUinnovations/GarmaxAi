import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/winston-logger';

/**
 * Watermark Service
 * Applies GarmaXAi logo watermark to images for free-tier users
 * Paid subscribers (studio/pro) receive watermark-free images
 */
export class WatermarkService {
  private logoPath: string;
  private logoBuffer: Buffer | null = null;

  constructor() {
    // Path to logo file in client public directory
    this.logoPath = path.join(process.cwd(), 'client', 'public', 'logo5.jpg');
  }

  /**
   * Load and cache the logo file
   * Converts to PNG with transparency support
   */
  private async loadLogo(): Promise<Buffer> {
    if (this.logoBuffer) {
      return this.logoBuffer;
    }

    try {
      const logoFile = await fs.readFile(this.logoPath);
      
      // Resize logo to consistent size and convert to PNG with alpha channel
      // Size: 400x100px works well for center watermark across various image sizes
      this.logoBuffer = await sharp(logoFile)
        .resize(400, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      logger.info('Watermark logo loaded and cached', 'WatermarkService');
      return this.logoBuffer;
    } catch (error) {
      logger.error(`Failed to load watermark logo: ${error}`, 'WatermarkService');
      throw new Error('Watermark logo file not found');
    }
  }

  /**
   * Apply watermark to image buffer based on user subscription tier
   * 
   * @param imageBuffer - Original image buffer
   * @param subscriptionTier - User's subscription tier ('free', 'studio', 'pro')
   * @param opacity - Watermark opacity (0-1), default 0.3 (30%)
   * @returns Watermarked image buffer (or original if paid user)
   */
  async applyWatermark(
    imageBuffer: Buffer,
    subscriptionTier: 'free' | 'studio' | 'pro',
    opacity: number = 0.3
  ): Promise<Buffer> {
    // Skip watermark for paid subscribers
    if (subscriptionTier !== 'free') {
      logger.info(`Skipping watermark for ${subscriptionTier} tier user`, 'WatermarkService');
      return imageBuffer;
    }

    try {
      // Load and prepare logo with opacity
      const logo = await this.loadLogo();
      
      // Apply opacity to logo
      const transparentLogo = await sharp(logo)
        .composite([{
          input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
          raw: {
            width: 1,
            height: 1,
            channels: 4
          },
          tile: true,
          blend: 'dest-in'
        }])
        .toBuffer();

      // Get image metadata to calculate center position
      const imageMetadata = await sharp(imageBuffer).metadata();
      const imageWidth = imageMetadata.width || 1024;
      const imageHeight = imageMetadata.height || 1024;

      // Calculate center position for watermark
      const logoWidth = 400;
      const logoHeight = 100;
      const left = Math.floor((imageWidth - logoWidth) / 2);
      const top = Math.floor((imageHeight - logoHeight) / 2);

      // Composite watermark at center of image
      const watermarkedBuffer = await sharp(imageBuffer)
        .composite([{
          input: transparentLogo,
          left,
          top,
          blend: 'over'
        }])
        .toBuffer();

      logger.info(`Watermark applied to image (${imageWidth}x${imageHeight}) for free tier user`, 'WatermarkService');
      return watermarkedBuffer;
    } catch (error) {
      logger.error(`Failed to apply watermark: ${error}`, 'WatermarkService');
      // Return original image if watermarking fails (fail gracefully)
      return imageBuffer;
    }
  }

  /**
   * Clear cached logo (useful for testing or if logo file changes)
   */
  clearCache(): void {
    this.logoBuffer = null;
    logger.info('Watermark logo cache cleared', 'WatermarkService');
  }
}

// Export singleton instance
export const watermarkService = new WatermarkService();

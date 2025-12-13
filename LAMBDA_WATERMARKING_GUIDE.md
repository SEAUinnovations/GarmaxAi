# Watermarking Implementation for AI Render Lambda

This document describes how to add watermarking to the AI Render Processor Lambda handler.

## Overview

The Lambda function needs to apply watermarks to rendered images for free-tier users before uploading to S3.

## Implementation Steps

### 1. Add Logo Asset to Lambda Package

Copy `client/public/logo5.jpg` to the Lambda deployment package:

```bash
# In iac/lambda-handlers/aiRenderProcessor/
mkdir -p assets
cp ../../../client/public/logo5.jpg assets/
```

Update `package.json` or build script to include assets folder in deployment.

### 2. Add Watermark Function to Lambda

Add this function to `iac/lambda-handlers/aiRenderProcessor/index.ts`:

```typescript
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Apply watermark to rendered image for free-tier users
 * @param imageBuffer - Rendered image buffer
 * @param subscriptionTier - User's subscription tier
 * @returns Watermarked image buffer (or original for paid users)
 */
async function applyWatermarkToRender(
  imageBuffer: Buffer,
  subscriptionTier: string
): Promise<Buffer> {
  // Skip watermark for paid subscribers
  if (subscriptionTier !== 'free') {
    console.log(`[Watermark] Skipping for ${subscriptionTier} tier user`);
    return imageBuffer;
  }

  try {
    // Load logo from assets
    const logoPath = path.join(__dirname, 'assets', 'logo5.jpg');
    const logoFile = fs.readFileSync(logoPath);
    
    // Prepare logo with consistent size
    const logo = await sharp(logoFile)
      .resize(400, 100, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toBuffer();

    // Apply 30% opacity to logo
    const transparentLogo = await sharp(logo)
      .composite([{
        input: Buffer.from([255, 255, 255, 77]), // 77 = 30% of 255
        raw: { 
          width: 1, 
          height: 1, 
          channels: 4 
        },
        tile: true,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Get image dimensions to center watermark
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width || 1024;
    const imageHeight = metadata.height || 1024;
    
    // Calculate center position
    const left = Math.floor((imageWidth - 400) / 2);
    const top = Math.floor((imageHeight - 100) / 2);

    // Composite watermark at center
    const watermarkedBuffer = await sharp(imageBuffer)
      .composite([{ 
        input: transparentLogo, 
        left, 
        top, 
        blend: 'over' 
      }])
      .toBuffer();

    console.log(`[Watermark] Applied to ${imageWidth}x${imageHeight} image for free tier user`);
    return watermarkedBuffer;
    
  } catch (error) {
    console.error('[Watermark] Failed to apply watermark:', error);
    // Return original image on error (fail gracefully)
    return imageBuffer;
  }
}
```

### 3. Fetch User Subscription Tier

Add this helper function to query the database:

```typescript
import mysql from 'mysql2/promise';

/**
 * Get user's subscription tier from database
 * @param userId - User ID
 * @returns Subscription tier ('free', 'studio', 'pro')
 */
async function getUserSubscriptionTier(userId: string): Promise<string> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.execute(
      'SELECT subscriptionTier FROM users WHERE id = ?',
      [userId]
    );
    
    const user = (rows as any[])[0];
    return user?.subscriptionTier || 'free';
    
  } finally {
    await connection.end();
  }
}
```

### 4. Integrate into Render Pipeline

Update the main handler where render completes (around line 470):

```typescript
// After AI rendering completes and image buffer is ready
const renderBuffer = await downloadImageFromReplicate(imageUrl);

// Fetch user's subscription tier
const userTier = await getUserSubscriptionTier(event.detail.userId);

// Apply watermark based on tier
const finalImageBuffer = await applyWatermarkToRender(renderBuffer, userTier);

// Upload watermarked image to S3
await s3Client.send(new PutObjectCommand({
  Bucket: process.env.RENDERS_BUCKET,
  Key: `final/${sessionId}/render.jpg`,
  Body: finalImageBuffer,
  ContentType: 'image/jpeg',
}));
```

### 5. Update Lambda Dependencies

Ensure `sharp` is included in Lambda dependencies:

```json
// iac/lambda-handlers/aiRenderProcessor/package.json
{
  "dependencies": {
    "sharp": "^0.33.1",
    "mysql2": "^3.6.5"
  }
}
```

### 6. Environment Variables

Ensure Lambda has access to database credentials:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

These should be configured in CDK stack (`iac/lib/GarmaxAiStack.ts`).

## Testing

1. **Test with free user**: Upload photo, generate try-on, verify watermark appears centered with 30% opacity
2. **Test with paid user**: Verify no watermark appears on studio/pro tier images
3. **Test error handling**: Verify graceful degradation if watermark fails (returns original image)
4. **Test logo loading**: Verify assets/logo5.jpg is included in Lambda package

## Rollback Plan

If watermarking causes issues:

1. Set `subscriptionTier !== 'free'` check to return early for all users
2. Deploy hotfix
3. Debug and redeploy with fix

## Performance Considerations

- Logo is loaded once per Lambda cold start (cached in memory)
- Watermarking adds ~100-200ms to render time
- Sharp library is already in Lambda layer (no additional overhead)
- Graceful failure ensures renders complete even if watermarking fails

import Replicate from "replicate";
import { logger } from "../utils/winston-logger";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

export interface RenderOptions {
  prompt: string;
  width?: number;
  height?: number;
  quality?: "sd" | "hd" | "4k";
  negativePrompt?: string;
}

export interface RenderResult {
  imageUrl: string;
  seed?: number;
  timeTaken: number;
}

/**
 * AI Rendering Service using Replicate
 * Supports Stable Diffusion XL for high-quality try-on renders
 */
export class AIRenderingService {
  /**
   * Generate image using Stable Diffusion XL on Replicate
   */
  async generateImage(options: RenderOptions): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      logger.info("Starting AI render with Replicate", "AIRenderingService");

      // Map quality to dimensions
      const dimensions = this.getQualityDimensions(options.quality || "sd");

      const output = (await replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt: options.prompt,
            width: options.width || dimensions.width,
            height: options.height || dimensions.height,
            negative_prompt: options.negativePrompt || "blurry, low quality, distorted, watermark, text, signature",
            num_inference_steps: dimensions.steps,
            guidance_scale: 7.5,
          },
        }
      )) as any;

      const imageUrl = Array.isArray(output) ? output[0] : output;
      const timeTaken = Date.now() - startTime;

      logger.info(`AI render complete in ${timeTaken}ms`, "AIRenderingService");

      return {
        imageUrl,
        timeTaken,
      };
    } catch (error) {
      logger.error(`AI rendering failed: ${error}`, "AIRenderingService");
      throw new Error(`AI rendering failed: ${error}`);
    }
  }

  /**
   * Get dimensions and settings based on quality tier
   */
  private getQualityDimensions(quality: string): {
    width: number;
    height: number;
    steps: number;
  } {
    switch (quality) {
      case "4k":
        return { width: 2048, height: 2048, steps: 50 };
      case "hd":
        return { width: 1024, height: 1024, steps: 40 };
      case "sd":
      default:
        return { width: 512, height: 512, steps: 30 };
    }
  }

  /**
   * Build complete try-on prompt from avatar and garment descriptions
   */
  buildTryOnPrompt(avatarDescription: string, garmentDescriptions: string[]): string {
    const garments = garmentDescriptions.join(", ");
    
    return `Professional fashion photography, full body shot of ${avatarDescription} ${garments}, 
studio lighting, high quality, detailed fabric textures, photorealistic, 8k, sharp focus, 
professional model photography, clean background, editorial fashion`;
  }

  /**
   * Generate a quick preview render (lower quality for 30s preview)
   */
  async generatePreview(options: RenderOptions): Promise<RenderResult> {
    return this.generateImage({
      ...options,
      quality: "sd",
      width: 512,
      height: 512,
    });
  }
}

export const aiRenderingService = new AIRenderingService();

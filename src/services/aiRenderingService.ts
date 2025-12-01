import Replicate from "replicate";
import { logger } from "../utils/winston-logger";
import { PersonProfile } from "./personAnalysisService";
import { BodyPresetOptions } from "../../client/src/components/BodyPresetAdjustment";
import { batchImageService } from "./batchImageService";
import { GeminiImageRequest } from "./geminiImageService";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

// Environment configuration for Gemini gradual rollout
const ENABLE_GEMINI_BATCH = process.env.ENABLE_GEMINI_BATCH === 'true';
const GEMINI_TRAFFIC_PERCENT = parseInt(process.env.GEMINI_TRAFFIC_PERCENT || '0');

export interface RenderOptions {
  prompt: string;
  width?: number;
  height?: number;
  quality?: "sd" | "hd" | "4k";
  negativePrompt?: string;
}

export interface TryOnRenderOptions {
  personImage: string;
  garmentImage: string;
  poseGuidance?: string;
  depthMap?: string;
  quality?: "sd" | "hd" | "4k";
  prompt?: string;
  negativePrompt?: string;
  personProfile?: PersonProfile;
  bodyPreset?: BodyPresetOptions;
  userId?: string;
}

export interface RenderResult {
  imageUrl: string;
  seed?: number;
  timeTaken: number;
  method?: "nano-banana" | "photomaker" | "sdxl-fallback";
  identitySimilarity?: number;
  fallbackReason?: string;
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
        method: "sdxl-fallback",
      };
    } catch (error) {
      logger.error(`AI rendering failed: ${error}`, "AIRenderingService");
      throw new Error(`AI rendering failed: ${error}`);
    }
  }

  /**
   * Generate virtual try-on using nano-banana with image inputs
   * 
   * GEMINI GRADUAL ROLLOUT LOGIC:
   * =============================
   * This method implements percentage-based traffic routing between Replicate and Gemini.
   * Rollout controlled by two environment variables:
   * 
   * 1. ENABLE_GEMINI_BATCH (boolean): Master feature flag
   *    - true: Gemini integration is active
   *    - false: All traffic goes to Replicate (default)
   * 
   * 2. GEMINI_TRAFFIC_PERCENT (0-100): Percentage of requests routed to Gemini
   *    - 0: No traffic to Gemini (safe default)
   *    - 10: 10% of requests → initial validation phase
   *    - 50: 50% of requests → expanded rollout
   *    - 100: All requests → full production
   * 
   * ROUTING ALGORITHM:
   * ==================
   * Uses deterministic hash-based distribution for consistent user experience:
   * 1. Hash user ID to get stable number (same user always gets same route)
   * 2. Calculate: hash(userId) % 100
   * 3. If result < GEMINI_TRAFFIC_PERCENT → route to Gemini
   * 4. Otherwise → route to Replicate Nano Banana
   * 
   * Why hash-based instead of random?
   * - Same user always sees same rendering quality (consistency)
   * - A/B testing friendly (can compare user cohorts)
   * - Gradual rollout without user experience jumping between providers
   * 
   * FALLBACK CHAIN:
   * ==============
   * If Gemini route is selected:
   * 1. TRY: Gemini batch processing
   * 2. ON FAILURE: Skip directly to PhotoMaker (Option B per requirements)
   * 3. ON FAILURE: Fall back to SDXL
   * 
   * If Replicate route is selected (or Gemini disabled):
   * 1. TRY: Replicate Nano Banana Pro
   * 2. ON FAILURE: PhotoMaker
   * 3. ON FAILURE: SDXL
   * 
   * VALIDATION GATES:
   * ================
   * Before increasing GEMINI_TRAFFIC_PERCENT, validate:
   * - Cost per image < $0.05
   * - P95 latency < 60 seconds
   * - Batch failure rate < 5%
   * - Quality parity score > 0.9 vs Nano Banana
   * 
   * Minimum validation period at each tier:
   * - 10%: 3 days + 500 images
   * - 50%: 7 days + 2000 images
   * - 100%: After successful 50% phase
   */
  async generateTryOnRender(options: TryOnRenderOptions): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      logger.info("Starting virtual try-on render", "AIRenderingService");

      // Map quality to dimensions
      const dimensions = this.getQualityDimensions(options.quality || "sd");

      // GEMINI ROUTING DECISION
      // =======================
      // Determine if this request should use Gemini or Replicate
      const shouldUseGemini = this.shouldRouteToGemini(options.userId);

      if (shouldUseGemini) {
        logger.info(
          `Routing to Gemini batch (traffic: ${GEMINI_TRAFFIC_PERCENT}%)`,
          "AIRenderingService"
        );

        try {
          // Build Gemini request from try-on options
          const geminiRequest: GeminiImageRequest = {
            personImage: options.personImage,
            garmentImage: options.garmentImage,
            quality: options.quality || 'sd',
            prompt: options.prompt,
            negativePrompt: options.negativePrompt,
            poseGuidance: options.poseGuidance,
            depthMap: options.depthMap,
          };

          // Queue request for batch processing
          // Returns immediately with request ID for status tracking
          const requestId = await batchImageService.queueRequest(
            options.userId || 'anonymous',
            geminiRequest
          );

          logger.info(
            `Queued Gemini batch request ${requestId}`,
            "AIRenderingService"
          );

          // TODO: Implement polling or webhook-based result retrieval
          // For now, this is a placeholder. Production implementation needs:
          // 1. Return requestId to client
          // 2. Client polls for status or receives WebSocket notification
          // 3. Results delivered via EventBridge → existing notification system
          
          // Temporary: Return pending status
          // Replace with actual result retrieval in production
          return {
            imageUrl: '', // Will be populated when batch completes
            timeTaken: Date.now() - startTime,
            method: "nano-banana", // Marking as nano-banana equivalent
          };

        } catch (geminiError) {
          logger.error(
            `Gemini batch processing failed: ${geminiError}. Falling back to PhotoMaker.`,
            "AIRenderingService"
          );

          // ON GEMINI FAILURE: Skip directly to PhotoMaker (Option B)
          // Do NOT retry with Replicate Nano Banana to avoid costs
          // This allows faster recovery and cost control
          try {
            const photomakerResult = await this.generatePhotoMakerRender(
              options,
              dimensions,
              startTime
            );
            if (photomakerResult) {
              return {
                ...photomakerResult,
                fallbackReason: "gemini-batch-failed-to-photomaker",
              };
            }
          } catch (photomakerError) {
            logger.warn(
              `PhotoMaker failed after Gemini, falling back to SDXL: ${photomakerError}`,
              "AIRenderingService"
            );
          }

          // Final fallback: SDXL with identity-aware prompting
          const enhancedPrompt = this.buildIdentityAwarePrompt(options);
          const sdxlResult = await this.generateImage({
            prompt: enhancedPrompt,
            quality: options.quality,
            negativePrompt: options.negativePrompt,
          });

          return {
            ...sdxlResult,
            fallbackReason: "gemini-and-photomaker-failed",
          };
        }
      }

      // REPLICATE NANO BANANA PATH
      // ==========================
      // Original Replicate-based rendering (pre-Gemini migration)
      // Used when:
      // - ENABLE_GEMINI_BATCH = false (feature disabled)
      // - GEMINI_TRAFFIC_PERCENT = 0 (no traffic to Gemini)
      // - User hash doesn't fall in Gemini percentage bucket
      
      logger.info("Using Replicate Nano Banana Pro", "AIRenderingService");

      // Try nano-banana first for proper virtual try-on
      try {
        const output = (await replicate.run(
          "google/nano-banana-pro:latest",
          {
            input: {
              image: options.personImage,
              garment: options.garmentImage,
              pose_image: options.poseGuidance,
              depth_map: options.depthMap,
              prompt: options.prompt || "professional fashion photography, high quality, detailed",
              negative_prompt: options.negativePrompt || "blurry, low quality, distorted, watermark, nude, nsfw",
              width: dimensions.width,
              height: dimensions.height,
              num_inference_steps: dimensions.steps,
              guidance_scale: 7.5,
              strength: dimensions.strength,
            },
          }
        )) as any;

        const imageUrl = Array.isArray(output) ? output[0] : output;
        const timeTaken = Date.now() - startTime;

        logger.info(`Nano-banana virtual try-on complete in ${timeTaken}ms`, "AIRenderingService");

        return {
          imageUrl,
          timeTaken,
          method: "nano-banana",
        };
      } catch (nanoBananaError) {
        logger.warn(`Nano-banana failed, trying PhotoMaker: ${nanoBananaError}`, "AIRenderingService");
        
        // Fallback 1: Try PhotoMaker for identity preservation
        try {
          const photomakerResult = await this.generatePhotoMakerRender(options, dimensions, startTime);
          if (photomakerResult) {
            return photomakerResult;
          }
        } catch (photomakerError) {
          logger.warn(`PhotoMaker failed, falling back to SDXL: ${photomakerError}`, "AIRenderingService");
        }
        
        // Fallback 2: SDXL with identity-aware prompting
        const enhancedPrompt = this.buildIdentityAwarePrompt(options);
        const sdxlResult = await this.generateImage({
          prompt: enhancedPrompt,
          quality: options.quality,
          negativePrompt: options.negativePrompt,
        });
        
        return {
          ...sdxlResult,
          fallbackReason: "nano-banana and photomaker failed"
        };
      }
    } catch (error) {
      logger.error(`Virtual try-on rendering failed: ${error}`, "AIRenderingService");
      throw new Error(`Virtual try-on rendering failed: ${error}`);
    }
  }



  /**
   * Get dimensions and settings based on quality tier
   */
  private getQualityDimensions(quality: string): {
    width: number;
    height: number;
    steps: number;
    strength: number;
  } {
    switch (quality) {
      case "4k":
        return { width: 2048, height: 2048, steps: 50, strength: 0.8 };
      case "hd":
        return { width: 1024, height: 1024, steps: 40, strength: 0.7 };
      case "sd":
      default:
        return { width: 512, height: 512, steps: 30, strength: 0.6 };
    }
  }

  /**
   * Determine if request should be routed to Gemini based on traffic percentage
   * 
   * ROUTING ALGORITHM:
   * ==================
   * Uses deterministic hash-based distribution for consistent user routing:
   * 
   * 1. Check if Gemini is enabled (ENABLE_GEMINI_BATCH flag)
   * 2. Check traffic percentage is > 0
   * 3. Hash user ID to get stable number (0-99)
   * 4. Compare hash result with traffic percentage
   * 
   * Example with GEMINI_TRAFFIC_PERCENT=50:
   * - User "alice" → hash=23 → 23 < 50 → routes to Gemini
   * - User "bob" → hash=67 → 67 >= 50 → routes to Replicate
   * - User "alice" again → hash=23 → always Gemini (consistent)
   * 
   * Why this approach?
   * - Deterministic: Same user always gets same provider (consistency)
   * - Uniform distribution: Hash spreads users evenly across providers
   * - A/B testing friendly: Can compare user cohorts over time
   * - Gradual rollout: Increase percentage without disrupting existing users
   * 
   * @param userId - User ID for routing decision (undefined = anonymous)
   * @returns true if should route to Gemini, false for Replicate
   */
  private shouldRouteToGemini(userId?: string): boolean {
    // Check master feature flag
    if (!ENABLE_GEMINI_BATCH) {
      return false;
    }

    // Check if traffic percentage is configured
    if (GEMINI_TRAFFIC_PERCENT <= 0) {
      return false;
    }

    // For anonymous users, use random routing
    // (not ideal but better than always routing to same path)
    if (!userId) {
      const randomValue = Math.floor(Math.random() * 100);
      return randomValue < GEMINI_TRAFFIC_PERCENT;
    }

    // Hash user ID to get deterministic number between 0-99
    // Using MD5 for simplicity (crypto-grade not needed for routing)
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    
    // Take first 8 hex chars and convert to number
    // Then modulo 100 to get value in range 0-99
    const hashNumber = parseInt(hash.substring(0, 8), 16) % 100;

    // Route to Gemini if hash value falls below traffic percentage
    const shouldRoute = hashNumber < GEMINI_TRAFFIC_PERCENT;

    logger.info(
      `Routing decision for user ${userId}: hash=${hashNumber}, threshold=${GEMINI_TRAFFIC_PERCENT}, gemini=${shouldRoute}`,
      "AIRenderingService"
    );

    return shouldRoute;
  }

  /**
   * Generate PhotoMaker render for identity preservation
   */
  private async generatePhotoMakerRender(
    options: TryOnRenderOptions, 
    dimensions: any, 
    startTime: number
  ): Promise<RenderResult | null> {
    try {
      const identityPrompt = this.buildIdentityAwarePrompt(options);
      
      const output = (await replicate.run(
        "tencentarc/photomaker:ddfc2b08d209f9fa8c1eca692712918bd449f695dabb4a958da31802a9570fe4",
        {
          input: {
            prompt: identityPrompt,
            input_image: options.personImage,
            input_image2: options.garmentImage,
            num_steps: dimensions.steps,
            style_name: "Photographic (Default)",
            num_outputs: 1,
            guidance_scale: 5.0,
            seed: Math.floor(Math.random() * 1000000),
            negative_prompt: options.negativePrompt || "blurry, low quality, distorted, watermark, nude, nsfw, deformed face, unnatural proportions"
          }
        }
      )) as any;

      const imageUrl = Array.isArray(output) ? output[0] : output;
      const timeTaken = Date.now() - startTime;

      logger.info(`PhotoMaker render complete in ${timeTaken}ms`, "AIRenderingService");

      return {
        imageUrl,
        timeTaken,
        method: "photomaker"
      };
    } catch (error) {
      logger.error(`PhotoMaker render failed: ${error}`, "AIRenderingService");
      return null;
    }
  }

  /**
   * Build identity-aware prompt using person profile and body preset
   */
  private buildIdentityAwarePrompt(options: TryOnRenderOptions): string {
    const parts = [];
    
    // Base photography context
    parts.push("Professional fashion photography");
    
    // Person description from profile
    if (options.personProfile?.detailedDescription) {
      parts.push(`of ${options.personProfile.detailedDescription}`);
    } else {
      parts.push("of person");
    }
    
    // Body preset adjustments
    if (options.bodyPreset) {
      const presetDescription = this.getBodyPresetDescription(options.bodyPreset);
      if (presetDescription) {
        parts.push(`with ${presetDescription}`);
      }
    }
    
    // Physical characteristics from profile
    if (options.personProfile) {
      const physicalTraits = this.extractPhysicalTraits(options.personProfile);
      if (physicalTraits.length > 0) {
        parts.push(physicalTraits.join(", "));
      }
    }
    
    // Garment context
    parts.push("wearing fashionable clothing");
    
    // Quality and style descriptors
    parts.push("studio lighting, high quality, detailed fabric textures, photorealistic");
    parts.push("maintain facial features and identity, natural expression");
    parts.push("professional model photography, clean background, editorial fashion");
    
    return parts.join(", ");
  }

  /**
   * Get body preset description for prompting
   */
  private getBodyPresetDescription(bodyPreset: BodyPresetOptions): string {
    const traits = [];
    
    // Base preset
    const presetDescriptions = {
      slim: "lean, slender build",
      average: "balanced, proportional physique", 
      athletic: "muscular, toned, athletic build",
      "plus-size": "curvy, full figure"
    };
    traits.push(presetDescriptions[bodyPreset.basePreset] || "balanced build");
    
    // Height adjustment
    if (bodyPreset.heightAdjustment !== 0) {
      if (bodyPreset.heightAdjustment > 10) traits.push("tall stature");
      else if (bodyPreset.heightAdjustment > 0) traits.push("above average height");
      else if (bodyPreset.heightAdjustment < -10) traits.push("petite stature");
      else if (bodyPreset.heightAdjustment < 0) traits.push("below average height");
    }
    
    // Skin tone adjustment
    if (bodyPreset.skinToneAdjustment === "darker") traits.push("slightly darker skin tone");
    else if (bodyPreset.skinToneAdjustment === "lighter") traits.push("slightly lighter skin tone");
    
    // Build variation
    if (bodyPreset.buildVariation > 5) traits.push("more defined features");
    else if (bodyPreset.buildVariation > 0) traits.push("slightly more defined");
    else if (bodyPreset.buildVariation < -5) traits.push("softer features");
    else if (bodyPreset.buildVariation < 0) traits.push("slightly softer");
    
    return traits.join(", ");
  }

  /**
   * Extract physical traits from person profile for prompting
   */
  private extractPhysicalTraits(profile: PersonProfile): string[] {
    const traits = [];
    
    if (profile.estimatedAge) {
      traits.push(`${Math.floor(profile.estimatedAge / 10) * 10}s`);
    }
    
    if (profile.gender) {
      traits.push(profile.gender);
    }
    
    if (profile.ethnicity) {
      traits.push(profile.ethnicity);
    }
    
    if (profile.skinTone) {
      traits.push(`${profile.skinTone} skin`);
    }
    
    if (profile.hairColor && profile.hairStyle) {
      traits.push(`${profile.hairColor} ${profile.hairStyle} hair`);
    }
    
    if (profile.eyeColor) {
      traits.push(`${profile.eyeColor} eyes`);
    }
    
    if (profile.faceShape) {
      traits.push(`${profile.faceShape} face`);
    }
    
    if (profile.facialFeatures && profile.facialFeatures.length > 0) {
      traits.push(...profile.facialFeatures);
    }
    
    return traits;
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

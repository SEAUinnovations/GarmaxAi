import Replicate from "replicate";
import { logger } from "../utils/winston-logger";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

export interface GarmentAnalysisResult {
  type: string;
  color: string;
  pattern?: string;
  brand?: string;
  isOverlayable: boolean;
  confidence: number;
  reason?: string;
  labels: Array<{ name: string; confidence: number }>;
}

const OVERLAYABLE_TYPES = ["shirt", "t-shirt", "pants", "jeans", "dress", "jacket", "coat"];
const MIN_CONFIDENCE_THRESHOLD = 80;

/**
 * Garment Analysis Service
 * Uses Replicate's Gemini Nano model for intelligent garment classification
 */
export class GarmentAnalysisService {
  /**
   * Analyze garment image using LLaVA-13B on Replicate
   */
  async analyzeGarment(imageBuffer: Buffer): Promise<GarmentAnalysisResult> {
    try {
      logger.info("Analyzing garment with LLaVA-13B via Replicate", "GarmentAnalysisService");

      // Convert buffer to base64 data URI
      const base64Image = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

      const prompt = `Analyze this garment/clothing item image in detail. Provide:
1. Garment type (shirt, t-shirt, pants, jeans, dress, jacket, coat, sweater, skirt, shorts, etc.)
2. Primary color (be specific: navy blue, red, black, white, etc.)
3. Pattern type if any (solid, striped, plaid, floral, graphic, logo, text, abstract, etc.)
4. Brand name if visible
5. Whether this has complex patterns/graphics/logos (yes/no)
6. Your confidence level (0-100)

Respond ONLY in this exact JSON format with no additional text:
{"type":"shirt","color":"navy blue","pattern":"solid","brand":null,"hasComplexPattern":false,"confidence":95}`;

      const output = (await replicate.run(
        "yorickvp/llava-13b:latest",
        {
          input: {
            image: base64Image,
            prompt: prompt,
          },
        }
      )) as any;

      const responseText = typeof output === 'string' ? output : JSON.stringify(output);
      logger.info("LLaVA response received", "GarmentAnalysisService");

      // Parse the response
      const analysis = this.parseGeminiResponse(responseText);

      // Determine if overlayable based on analysis
      const overlayability = this.classifyOverlayability(
        analysis.type,
        analysis.hasComplexPattern,
        analysis.confidence
      );

      const result: GarmentAnalysisResult = {
        type: analysis.type,
        color: analysis.color,
        pattern: analysis.pattern || undefined,
        brand: analysis.brand || undefined,
        isOverlayable: overlayability.isOverlayable,
        confidence: analysis.confidence / 100,
        reason: overlayability.reason,
        labels: [
          { name: analysis.type, confidence: analysis.confidence },
          { name: analysis.color, confidence: analysis.confidence },
          { name: analysis.pattern || "solid", confidence: analysis.confidence },
        ],
      };

      logger.info(
        `Garment analyzed: type=${analysis.type}, overlayable=${overlayability.isOverlayable}`,
        "GarmentAnalysisService"
      );

      return result;
    } catch (error) {
      logger.error(`Garment analysis failed: ${error}`, "GarmentAnalysisService");
      
      // Return conservative fallback
      return {
        type: "unknown",
        color: "unknown",
        isOverlayable: false,
        confidence: 0,
        reason: "Analysis failed - defaulting to AI prompt rendering for safety",
        labels: [],
      };
    }
  }

  /**
   * Parse LLaVA JSON response
   */
  private parseGeminiResponse(output: string): {
    type: string;
    color: string;
    pattern: string | null;
    brand: string | null;
    hasComplexPattern: boolean;
    confidence: number;
  } {
    try {
      // Extract JSON from response (it might have extra text)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        type: (parsed.type || "unknown").toLowerCase(),
        color: parsed.color || "unknown",
        pattern: parsed.pattern || null,
        brand: parsed.brand || null,
        hasComplexPattern: parsed.hasComplexPattern || false,
        confidence: parsed.confidence || 50,
      };
    } catch (error) {
      logger.error("Failed to parse LLaVA response", "GarmentAnalysisService");
      return {
        type: "unknown",
        color: "unknown",
        pattern: null,
        brand: null,
        hasComplexPattern: true,
        confidence: 50,
      };
    }
  }

  /**
   * Classify if garment is suitable for simple texture overlay
   * Conservative approach: only allow overlay for simple, solid garments
   */
  private classifyOverlayability(
    type: string,
    hasComplexPattern: boolean,
    confidence: number
  ): { isOverlayable: boolean; confidence: number; reason?: string } {
    // Check confidence threshold
    if (confidence < MIN_CONFIDENCE_THRESHOLD) {
      return {
        isOverlayable: false,
        confidence,
        reason: `Low confidence (${confidence}%) - using AI prompt for better results`,
      };
    }

    // Check if type is overlayable
    if (!OVERLAYABLE_TYPES.includes(type)) {
      return {
        isOverlayable: false,
        confidence,
        reason: `Garment type '${type}' not suitable for simple overlay - using AI prompt`,
      };
    }

    // Check for complex patterns
    if (hasComplexPattern) {
      return {
        isOverlayable: false,
        confidence,
        reason: "Complex patterns/graphics detected - AI prompt will render these better",
      };
    }

    // All checks passed
    return {
      isOverlayable: true,
      confidence,
    };
  }

  /**
   * Generate detailed description for AI prompt (non-overlayable items)
   */
  generatePromptDescription(analysis: GarmentAnalysisResult): string {
    const parts: string[] = [];

    if (analysis.brand) {
      parts.push(analysis.brand);
    }

    if (analysis.color !== "unknown") {
      parts.push(analysis.color);
    }

    if (analysis.pattern) {
      parts.push(analysis.pattern);
    }

    parts.push(analysis.type);

    return parts.join(" ");
  }
}

export const garmentAnalysisService = new GarmentAnalysisService();

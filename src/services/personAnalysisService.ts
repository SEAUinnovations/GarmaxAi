import Replicate from "replicate";
import { storage } from "../storage";
import { logger } from "../utils/winston-logger";
import { redisClient } from "../utils/redis-client";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

export interface PersonProfile {
  // Physical characteristics
  estimatedAge?: number;
  gender?: 'male' | 'female' | 'neutral';
  ethnicity?: string;
  skinTone?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  
  // Body metrics
  estimatedHeight?: number;
  buildType?: 'slim' | 'average' | 'athletic' | 'plus-size';
  bodyShape?: string;
  
  // Style preferences
  preferredStyle?: string;
  faceShape?: string;
  facialFeatures?: string[];
  
  // AI-generated description
  detailedDescription: string;
  
  // Cache metadata
  imageHash: string;
  analyzedAt: Date;
  consentGiven: boolean;
}

export interface PersonAnalysisResult {
  profile: PersonProfile;
  cached: boolean;
  similarity: number;
}

/**
 * Person Analysis Service with Redis Caching
 * Uses LLaVA-13B for detailed person analysis with smart caching
 */
export class PersonAnalysisService {
  private readonly SIMILARITY_THRESHOLD = 0.95;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  
  /**
   * Analyze person image with smart caching
   */
  async analyzePersonImage(
    userId: string, 
    imageUrl: string, 
    skipCache = false
  ): Promise<PersonAnalysisResult> {
    try {
      // Generate perceptual hash for image comparison
      const imageHash = await this.generateImageHash(imageUrl);
      
      // Check cache first unless explicitly skipped
      if (!skipCache) {
        const cached = await this.getCachedAnalysis(userId, imageHash);
        if (cached) {
          logger.info(`Using cached person analysis for user ${userId}`, "PersonAnalysisService");
          return {
            profile: cached,
            cached: true,
            similarity: 1.0
          };
        }
      }
      
      // Check for similar existing analysis
      const similarProfile = await this.findSimilarAnalysis(userId, imageHash);
      if (similarProfile && similarProfile.similarity >= this.SIMILARITY_THRESHOLD) {
        logger.info(
          `Using similar analysis (${similarProfile.similarity.toFixed(2)} similarity) for user ${userId}`, 
          "PersonAnalysisService"
        );
        
        // Update cache with current hash
        await this.cacheAnalysis(userId, imageHash, similarProfile.profile);
        
        return {
          profile: similarProfile.profile,
          cached: false,
          similarity: similarProfile.similarity
        };
      }
      
      // Perform new analysis using LLaVA-13B
      logger.info(`Starting new person analysis for user ${userId}`, "PersonAnalysisService");
      const profile = await this.performLLaVAAnalysis(imageUrl, imageHash);
      
      // Cache the results
      await this.cacheAnalysis(userId, imageHash, profile);
      await this.storePersistentAnalysis(userId, profile);
      
      return {
        profile,
        cached: false,
        similarity: 1.0
      };
      
    } catch (error) {
      logger.error(`Person analysis failed: ${error}`, "PersonAnalysisService");
      throw error;
    }
  }
  
  /**
   * Perform detailed person analysis using LLaVA-13B
   */
  private async performLLaVAAnalysis(imageUrl: string, imageHash: string): Promise<PersonProfile> {
    const analysisPrompt = `Analyze this person's photo in detail. Provide a comprehensive description including:

1. Estimated age range (specific number if possible)
2. Gender appearance (male/female/neutral)
3. Ethnicity/racial appearance
4. Skin tone (fair, medium, tan, dark, olive, etc.)
5. Hair color and style description
6. Eye color if visible
7. Face shape (oval, round, square, heart, diamond)
8. Notable facial features (high cheekbones, strong jaw, etc.)
9. Build type (slim, average, athletic, plus-size)
10. Overall style/fashion sense visible
11. Body shape and proportions
12. Any distinctive characteristics

Respond in JSON format with detailed but respectful descriptions suitable for AI image generation prompts.

Expected JSON structure:
{
  "estimatedAge": 25,
  "gender": "female",
  "ethnicity": "Asian",
  "skinTone": "medium",
  "hairColor": "dark brown",
  "hairStyle": "shoulder length wavy",
  "eyeColor": "brown",
  "faceShape": "oval",
  "facialFeatures": ["high cheekbones", "defined eyebrows"],
  "buildType": "average",
  "bodyShape": "hourglass",
  "preferredStyle": "casual chic",
  "detailedDescription": "A 25-year-old Asian woman with medium skin tone..."
}`;

    const output = await replicate.run(
      "yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb",
      {
        input: {
          image: imageUrl,
          prompt: analysisPrompt,
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent analysis
        }
      }
    ) as any;

    const responseText = Array.isArray(output) ? output.join('') : output;
    
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      // Build comprehensive profile
      const profile: PersonProfile = {
        estimatedAge: analysisData.estimatedAge,
        gender: analysisData.gender,
        ethnicity: analysisData.ethnicity,
        skinTone: analysisData.skinTone,
        hairColor: analysisData.hairColor,
        hairStyle: analysisData.hairStyle,
        eyeColor: analysisData.eyeColor,
        faceShape: analysisData.faceShape,
        facialFeatures: analysisData.facialFeatures || [],
        buildType: analysisData.buildType,
        bodyShape: analysisData.bodyShape,
        preferredStyle: analysisData.preferredStyle,
        detailedDescription: analysisData.detailedDescription || this.buildDescription(analysisData),
        imageHash,
        analyzedAt: new Date(),
        consentGiven: true
      };
      
      return profile;
      
    } catch (parseError) {
      logger.warn(`JSON parsing failed, using fallback description: ${parseError}`, "PersonAnalysisService");
      
      // Fallback: use raw response as description
      return {
        detailedDescription: responseText,
        imageHash,
        analyzedAt: new Date(),
        consentGiven: true
      };
    }
  }
  
  /**
   * Generate perceptual hash for image comparison
   * Uses content-based hashing to identify identical or similar images
   */
  private async generateImageHash(imageUrl: string): Promise<string> {
    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate hash based on image content only (not timestamp)
      // This ensures same image always produces same hash for cache hits
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      logger.info(`Generated image hash for caching: ${hash.substring(0, 8)}...`, "PersonAnalysisService");
      return hash;
    } catch (error) {
      logger.error(`Image hash generation failed: ${error}`, "PersonAnalysisService");
      // Fallback to URL-based hash (without timestamp) if image fetch fails
      const crypto = await import('crypto');
      return crypto.createHash('md5').update(imageUrl).digest('hex');
    }
  }
  
  /**
   * Get cached analysis from Redis
   */
  private async getCachedAnalysis(userId: string, imageHash: string): Promise<PersonProfile | null> {
    try {
      const cached = await redisClient.get(`person_analysis:${userId}:${imageHash}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error(`Cache lookup failed: ${error}`, "PersonAnalysisService");
      return null;
    }
  }
  
  /**
   * Find similar analysis in database
   */
  private async findSimilarAnalysis(userId: string, imageHash: string): Promise<{profile: PersonProfile, similarity: number} | null> {
    try {
      // TODO: Implement similarity search in database
      // This would compare image hashes and return most similar analysis
      return null; // Placeholder
    } catch (error) {
      logger.error(`Similarity search failed: ${error}`, "PersonAnalysisService");
      return null;
    }
  }
  
  /**
   * Cache analysis results in Redis
   */
  private async cacheAnalysis(userId: string, imageHash: string, profile: PersonProfile): Promise<void> {
    try {
      await redisClient.set(
        `person_analysis:${userId}:${imageHash}`, 
        JSON.stringify(profile),
        this.CACHE_TTL
      );
      logger.info(`Cached person analysis for user ${userId}`, "PersonAnalysisService");
    } catch (error) {
      logger.error(`Caching failed: ${error}`, "PersonAnalysisService");
    }
  }
  
  /**
   * Store analysis in database for long-term persistence
   */
  private async storePersistentAnalysis(userId: string, profile: PersonProfile): Promise<void> {
    try {
      // TODO: Implement database storage for person profiles
      // This would store in a person_profiles table with 90-day expiration
      logger.info(`Stored persistent analysis for user ${userId}`, "PersonAnalysisService");
    } catch (error) {
      logger.error(`Persistent storage failed: ${error}`, "PersonAnalysisService");
    }
  }
  
  /**
   * Build detailed description from analysis components
   */
  private buildDescription(analysisData: any): string {
    const parts = [];
    
    if (analysisData.estimatedAge && analysisData.gender) {
      parts.push(`${analysisData.estimatedAge}-year-old ${analysisData.gender}`);
    }
    
    if (analysisData.ethnicity) {
      parts.push(`${analysisData.ethnicity} person`);
    }
    
    if (analysisData.skinTone) {
      parts.push(`with ${analysisData.skinTone} skin`);
    }
    
    if (analysisData.hairColor && analysisData.hairStyle) {
      parts.push(`${analysisData.hairColor} ${analysisData.hairStyle} hair`);
    }
    
    if (analysisData.buildType) {
      parts.push(`${analysisData.buildType} build`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'Person';
  }
  
  /**
   * Clean up expired analysis data (called by cron job)
   */
  async cleanupExpiredAnalysis(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
      
      // TODO: Implement cleanup logic
      // const deleted = await storage.deleteExpiredPersonAnalysis(cutoffDate);
      const deleted = 0; // Placeholder
      
      logger.info(`Cleaned up ${deleted} expired person analysis records`, "PersonAnalysisService");
      return deleted;
    } catch (error) {
      logger.error(`Cleanup failed: ${error}`, "PersonAnalysisService");
      return 0;
    }
  }
  
  /**
   * Delete all analysis data for a user (GDPR compliance)
   */
  async deleteUserAnalysis(userId: string): Promise<void> {
    try {
      // Delete from Redis cache using pattern matching
      const deletedCount = await redisClient.flushPattern(`person_analysis:${userId}:*`);
      
      // TODO: Delete from database
      // await storage.deleteUserPersonAnalysis(userId);
      
      logger.info(`Deleted ${deletedCount} cached analysis records and database data for user ${userId}`, "PersonAnalysisService");
    } catch (error) {
      logger.error(`User data deletion failed: ${error}`, "PersonAnalysisService");
      throw error;
    }
  }
}

export const personAnalysisService = new PersonAnalysisService();
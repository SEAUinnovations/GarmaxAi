import { logger } from "../utils/winston-logger";
import { PersonProfile } from "./personAnalysisService";
import { BodyPresetOptions } from "../../client/src/components/BodyPresetAdjustment";

export interface DebouncedRenderRequest {
  id: string;
  userId: string;
  personImage: string;
  garmentImage: string;
  bodyPreset: BodyPresetOptions;
  personProfile?: PersonProfile;
  quality?: "sd" | "hd" | "4k";
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BatchRenderOptions {
  requests: DebouncedRenderRequest[];
  maxBatchSize?: number;
  timeoutMs?: number;
}

export interface RenderPreview {
  id: string;
  expectedPrompt: string;
  estimatedCost: number;
  estimatedTime: number;
  changes: string[];
}

/**
 * Debounced Render Service
 * Optimizes API usage through debouncing and batch processing
 */
export class DebouncedRenderService {
  private readonly DEBOUNCE_DELAY = 2000; // 2 seconds
  private readonly MAX_BATCH_SIZE = 3;
  private readonly PREVIEW_MODE_DELAY = 500; // 0.5 seconds for preview updates
  
  private pendingRequests = new Map<string, DebouncedRenderRequest>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private previewTimers = new Map<string, NodeJS.Timeout>();
  private processingBatch = false;
  
  /**
   * Queue a render request with debouncing
   */
  async queueRender(
    userId: string,
    personImage: string,
    garmentImage: string,
    bodyPreset: BodyPresetOptions,
    personProfile?: PersonProfile,
    quality: "sd" | "hd" | "4k" = "hd"
  ): Promise<string> {
    const requestId = this.generateRequestId(userId, personImage, garmentImage);
    
    // Clear existing timer if user is making more adjustments
    const existingTimer = this.debounceTimers.get(requestId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Create or update request
    const request: DebouncedRenderRequest = {
      id: requestId,
      userId,
      personImage,
      garmentImage,
      bodyPreset,
      personProfile,
      quality,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.pendingRequests.set(requestId, request);
    
    logger.info(
      `Queued render request ${requestId} for user ${userId} (debounce: ${this.DEBOUNCE_DELAY}ms)`, 
      "DebouncedRenderService"
    );
    
    // Set debounce timer
    const timer = setTimeout(() => {
      this.processRequest(requestId);
    }, this.DEBOUNCE_DELAY);
    
    this.debounceTimers.set(requestId, timer);
    
    return requestId;
  }
  
  /**
   * Generate preview without API calls
   */
  async generatePreview(
    userId: string,
    personImage: string,
    garmentImage: string,
    bodyPreset: BodyPresetOptions,
    personProfile?: PersonProfile
  ): Promise<RenderPreview> {
    const requestId = this.generateRequestId(userId, personImage, garmentImage);
    
    // Clear existing preview timer
    const existingTimer = this.previewTimers.get(requestId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Generate preview after short delay to avoid excessive updates
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const preview = this.buildPreview(requestId, bodyPreset, personProfile);
        resolve(preview);
      }, this.PREVIEW_MODE_DELAY);
      
      this.previewTimers.set(requestId, timer);
    });
  }
  
  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pending: number;
    processing: number;
    totalRequests: number;
    estimatedWaitTime: number;
  } {
    const pending = Array.from(this.pendingRequests.values()).filter(r => r.status === 'pending').length;
    const processing = Array.from(this.pendingRequests.values()).filter(r => r.status === 'processing').length;
    const total = this.pendingRequests.size;
    
    // Estimate wait time based on queue size and average processing time
    const averageProcessingTime = 15000; // 15 seconds average
    const estimatedWaitTime = (pending + processing) * averageProcessingTime;
    
    return {
      pending,
      processing,
      totalRequests: total,
      estimatedWaitTime
    };
  }
  
  /**
   * Cancel a pending render request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.pendingRequests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }
    
    // Clear debounce timer
    const timer = this.debounceTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(requestId);
    }
    
    // Remove from queue
    this.pendingRequests.delete(requestId);
    
    logger.info(`Cancelled render request ${requestId}`, "DebouncedRenderService");
    return true;
  }
  
  /**
   * Process a single request (called after debounce delay)
   */
  private async processRequest(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return;
    }
    
    try {
      request.status = 'processing';
      
      logger.info(`Processing render request ${requestId}`, "DebouncedRenderService");
      
      // Check if we can batch this request with others
      const batchCandidates = this.findBatchCandidates(request);
      
      if (batchCandidates.length > 1) {
        await this.processBatch(batchCandidates);
      } else {
        await this.processSingleRequest(request);
      }
      
    } catch (error) {
      logger.error(`Failed to process request ${requestId}: ${error}`, "DebouncedRenderService");
      request.status = 'failed';
    } finally {
      this.debounceTimers.delete(requestId);
    }
  }
  
  /**
   * Process multiple requests as a batch
   */
  private async processBatch(requests: DebouncedRenderRequest[]): Promise<void> {
    if (this.processingBatch) {
      // Queue for next batch if already processing
      setTimeout(() => this.processBatch(requests), 1000);
      return;
    }
    
    this.processingBatch = true;
    
    try {
      logger.info(
        `Processing batch of ${requests.length} render requests`, 
        "DebouncedRenderService"
      );
      
      // Process requests in parallel with controlled concurrency
      const promises = requests.slice(0, this.MAX_BATCH_SIZE).map(request => 
        this.processSingleRequest(request).catch(error => {
          logger.error(`Batch request ${request.id} failed: ${error}`, "DebouncedRenderService");
          request.status = 'failed';
        })
      );
      
      await Promise.allSettled(promises);
      
    } finally {
      this.processingBatch = false;
    }
  }
  
  /**
   * Process a single render request
   */
  private async processSingleRequest(request: DebouncedRenderRequest): Promise<void> {
    try {
      // Import AI rendering service dynamically to avoid circular dependencies
      const { aiRenderingService } = await import("./aiRenderingService");
      
      // Build enhanced prompt from body preset and person profile
      const prompt = this.buildEnhancedPrompt(request.bodyPreset, request.personProfile);
      
      // Generate the render
      const result = await aiRenderingService.generateTryOnRender({
        personImage: request.personImage,
        garmentImage: request.garmentImage,
        quality: request.quality,
        prompt
      });
      
      request.status = 'completed';
      
      logger.info(
        `Completed render request ${request.id} in ${result.timeTaken}ms using ${result.method}`, 
        "DebouncedRenderService"
      );
      
      // TODO: Store result and notify user
      // await this.notifyCompletion(request, result);
      
    } catch (error) {
      request.status = 'failed';
      throw error;
    }
  }
  
  /**
   * Find requests that can be batched together
   */
  private findBatchCandidates(currentRequest: DebouncedRenderRequest): DebouncedRenderRequest[] {
    const candidates = [currentRequest];
    
    // Look for other pending requests from the same user or similar characteristics
    for (const [id, request] of Array.from(this.pendingRequests.entries())) {
      if (
        id !== currentRequest.id &&
        request.status === 'pending' &&
        request.userId === currentRequest.userId &&
        candidates.length < this.MAX_BATCH_SIZE
      ) {
        candidates.push(request);
      }
    }
    
    return candidates;
  }
  
  /**
   * Build preview without API calls
   */
  private buildPreview(
    requestId: string,
    bodyPreset: BodyPresetOptions,
    personProfile?: PersonProfile
  ): RenderPreview {
    const prompt = this.buildEnhancedPrompt(bodyPreset, personProfile);
    const changes = this.detectChanges(bodyPreset);
    
    return {
      id: requestId,
      expectedPrompt: prompt,
      estimatedCost: this.estimateRenderCost(bodyPreset),
      estimatedTime: this.estimateRenderTime(bodyPreset),
      changes
    };
  }
  
  /**
   * Build enhanced prompt from body preset and person profile
   */
  private buildEnhancedPrompt(bodyPreset: BodyPresetOptions, personProfile?: PersonProfile): string {
    const parts = [];
    
    // Base description from person profile
    if (personProfile?.detailedDescription) {
      parts.push(personProfile.detailedDescription);
    }
    
    // Body preset adjustments
    parts.push(this.getPresetDescription(bodyPreset));
    
    // Height adjustment
    if (bodyPreset.heightAdjustment !== 0) {
      const heightDesc = this.getHeightDescription(bodyPreset.heightAdjustment);
      parts.push(heightDesc);
    }
    
    // Skin tone adjustment
    if (bodyPreset.skinToneAdjustment !== 'same') {
      parts.push(this.getSkinToneDescription(bodyPreset.skinToneAdjustment));
    }
    
    // Build variation
    if (bodyPreset.buildVariation !== 0) {
      parts.push(this.getBuildVariationDescription(bodyPreset.buildVariation));
    }
    
    // Custom descriptors
    if (bodyPreset.customDescriptors.length > 0) {
      parts.push(...bodyPreset.customDescriptors);
    }
    
    return `Professional fashion photography of ${parts.join(', ')}, high quality, detailed, photorealistic, studio lighting`;
  }
  
  /**
   * Detect what changes were made from defaults
   */
  private detectChanges(bodyPreset: BodyPresetOptions): string[] {
    const changes = [];
    
    if (bodyPreset.basePreset !== 'average') {
      changes.push(`Body type: ${bodyPreset.basePreset}`);
    }
    
    if (bodyPreset.heightAdjustment !== 0) {
      const direction = bodyPreset.heightAdjustment > 0 ? 'taller' : 'shorter';
      changes.push(`Height: ${Math.abs(bodyPreset.heightAdjustment)}% ${direction}`);
    }
    
    if (bodyPreset.skinToneAdjustment !== 'same') {
      changes.push(`Skin tone: ${bodyPreset.skinToneAdjustment}`);
    }
    
    if (bodyPreset.buildVariation !== 0) {
      const variation = bodyPreset.buildVariation > 0 ? 'more defined' : 'softer';
      changes.push(`Build: ${variation}`);
    }
    
    if (bodyPreset.customDescriptors.length > 0) {
      changes.push(`Custom: ${bodyPreset.customDescriptors.join(', ')}`);
    }
    
    return changes.length > 0 ? changes : ['No changes from original'];
  }
  
  private generateRequestId(userId: string, personImage: string, garmentImage: string): string {
    const crypto = require('crypto');
    const input = `${userId}-${personImage}-${garmentImage}-${Date.now()}`;
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 12);
  }
  
  private getPresetDescription(preset: BodyPresetOptions): string {
    const descriptions = {
      slim: 'lean, slender build',
      average: 'balanced, proportional physique',
      athletic: 'muscular, toned, athletic build',
      'plus-size': 'curvy, full figure'
    };
    return descriptions[preset.basePreset] || 'balanced build';
  }
  
  private getHeightDescription(adjustment: number): string {
    if (adjustment > 10) return 'tall stature';
    if (adjustment > 0) return 'above average height';
    if (adjustment < -10) return 'petite stature';
    if (adjustment < 0) return 'below average height';
    return 'average height';
  }
  
  private getSkinToneDescription(adjustment: BodyPresetOptions['skinToneAdjustment']): string {
    const descriptions = {
      darker: 'slightly darker skin tone',
      lighter: 'slightly lighter skin tone',
      same: 'natural skin tone'
    };
    return descriptions[adjustment] || 'natural skin tone';
  }
  
  private getBuildVariationDescription(variation: number): string {
    if (variation > 5) return 'more defined features';
    if (variation > 0) return 'slightly more defined';
    if (variation < -5) return 'softer features';
    if (variation < 0) return 'slightly softer';
    return 'natural build';
  }
  
  private estimateRenderCost(preset: BodyPresetOptions): number {
    // Base cost estimation (in credits or dollars)
    let baseCost = 0.05; // $0.05 base cost
    
    // More complex presets might cost slightly more
    if (preset.basePreset === 'athletic' || preset.basePreset === 'plus-size') {
      baseCost += 0.01;
    }
    
    // Additional adjustments add minimal cost
    const adjustments = [
      preset.heightAdjustment !== 0,
      preset.skinToneAdjustment !== 'same',
      preset.buildVariation !== 0,
      preset.customDescriptors.length > 0
    ].filter(Boolean).length;
    
    baseCost += adjustments * 0.005;
    
    return Math.round(baseCost * 100) / 100; // Round to 2 decimal places
  }
  
  private estimateRenderTime(preset: BodyPresetOptions): number {
    // Base time estimation in seconds
    let baseTime = 12; // 12 seconds base
    
    // Complex presets take slightly longer
    if (preset.basePreset === 'athletic' || preset.basePreset === 'plus-size') {
      baseTime += 2;
    }
    
    // Additional adjustments add minimal time
    const adjustments = [
      preset.heightAdjustment !== 0,
      preset.skinToneAdjustment !== 'same',
      preset.buildVariation !== 0,
      preset.customDescriptors.length > 0
    ].filter(Boolean).length;
    
    baseTime += adjustments * 1;
    
    return baseTime;
  }
  
  /**
   * Clean up completed and failed requests periodically
   */
  async cleanup(): Promise<number> {
    const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
    let cleaned = 0;
    
    for (const [id, request] of Array.from(this.pendingRequests.entries())) {
      if (
        request.timestamp < cutoffTime &&
        (request.status === 'completed' || request.status === 'failed')
      ) {
        this.pendingRequests.delete(id);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned up ${cleaned} old render requests`, "DebouncedRenderService");
    return cleaned;
  }
}

export const debouncedRenderService = new DebouncedRenderService();
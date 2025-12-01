import { redisClient } from "../utils/redis-client";
import { storage } from "../storage";
import { logger } from "../utils/winston-logger";

export interface ProfileAnalytics {
  totalUsers: number;
  completedProfiles: number;
  completionRate: number;
  avgCompletionTime: number; // in hours
  completionsByAge: Record<string, number>;
  completionsByGender: Record<string, number>;
  completionsByBodyType: Record<string, number>;
  abandonmentPoints: Record<string, number>;
  abTestResults: Record<string, ABTestResults>;
}

export interface ABTestResults {
  variant: string;
  users: number;
  completions: number;
  completionRate: number;
  avgCompletionTime: number;
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // 0-1, should sum to 1 across variants
  config: {
    showBenefits: boolean;
    bonusCredits: number;
    formLayout: 'single-page' | 'multi-step';
    benefitsStyle: 'visual' | 'text' | 'video';
  };
}

export interface ProfileAnalyticsEvent {
  userId: string;
  eventType: 'profile_start' | 'profile_complete' | 'profile_abandon' | 'field_complete';
  eventData: {
    step?: string;
    field?: string;
    completionTime?: number;
    abVariant?: string;
    profileCompletionPercentage?: number;
  };
  timestamp: Date;
}

class ProfileAnalyticsService {
  private readonly AB_TEST_KEY = 'profile_ab_test';
  private readonly ANALYTICS_KEY = 'profile_analytics';
  private readonly COMPLETION_TIME_KEY = 'profile_completion_time';
  
  // A/B Test variants for profile collection optimization
  private readonly AB_VARIANTS: ABTestVariant[] = [
    {
      id: 'control',
      name: 'Control - Standard Flow',
      weight: 0.4,
      config: {
        showBenefits: true,
        bonusCredits: 5,
        formLayout: 'single-page',
        benefitsStyle: 'visual'
      }
    },
    {
      id: 'higher_bonus',
      name: 'Higher Bonus Credits',
      weight: 0.2,
      config: {
        showBenefits: true,
        bonusCredits: 10,
        formLayout: 'single-page',
        benefitsStyle: 'visual'
      }
    },
    {
      id: 'multi_step',
      name: 'Multi-step Form',
      weight: 0.2,
      config: {
        showBenefits: true,
        bonusCredits: 5,
        formLayout: 'multi-step',
        benefitsStyle: 'visual'
      }
    },
    {
      id: 'text_benefits',
      name: 'Text-only Benefits',
      weight: 0.2,
      config: {
        showBenefits: true,
        bonusCredits: 5,
        formLayout: 'single-page',
        benefitsStyle: 'text'
      }
    }
  ];
  
  /**
   * Get A/B test variant for user
   */
  async getABVariant(userId: string): Promise<ABTestVariant> {
    try {
      // Check if user already has a variant assigned
      const existing = await redisClient.get(`${this.AB_TEST_KEY}:${userId}`);
      if (existing) {
        const variant = this.AB_VARIANTS.find(v => v.id === existing);
        if (variant) {
          return variant;
        }
      }
      
      // Assign new variant based on weights
      const random = Math.random();
      let cumulative = 0;
      
      for (const variant of this.AB_VARIANTS) {
        cumulative += variant.weight;
        if (random <= cumulative) {
          // Store assignment (expires in 30 days)
          await redisClient.set(`${this.AB_TEST_KEY}:${userId}`, variant.id, 30 * 24 * 3600);
          
          // Track assignment
          await this.trackEvent({
            userId,
            eventType: 'profile_start',
            eventData: { abVariant: variant.id },
            timestamp: new Date()
          });
          
          logger.info(`Assigned A/B variant ${variant.id} to user ${userId}`, 'ProfileAnalyticsService');
          return variant;
        }
      }
      
      // Fallback to control
      const control = this.AB_VARIANTS[0];
      await redisClient.set(`${this.AB_TEST_KEY}:${userId}`, control.id, 30 * 24 * 3600);
      return control;
      
    } catch (error) {
      logger.error(`A/B test assignment failed: ${error}`, 'ProfileAnalyticsService');
      return this.AB_VARIANTS[0]; // Fallback to control
    }
  }
  
  /**
   * Track profile-related events
   */
  async trackEvent(event: ProfileAnalyticsEvent): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Track in Redis for real-time analytics
      await redisClient.incr(`${this.ANALYTICS_KEY}:${event.eventType}:${today}`);
      
      // Track A/B variant specific metrics
      if (event.eventData.abVariant) {
        await redisClient.incr(`${this.ANALYTICS_KEY}:${event.eventType}:variant:${event.eventData.abVariant}:${today}`);
      }
      
      // Track completion times
      if (event.eventType === 'profile_complete' && event.eventData.completionTime) {
        await redisClient.set(
          `${this.COMPLETION_TIME_KEY}:${event.userId}`,
          event.eventData.completionTime.toString(),
          7 * 24 * 3600 // 7 days TTL
        );
      }
      
      // Track abandonment points
      if (event.eventType === 'profile_abandon' && event.eventData.step) {
        await redisClient.incr(`${this.ANALYTICS_KEY}:abandonment:${event.eventData.step}:${today}`);
      }
      
      // Store detailed event in database for long-term analysis
      await this.storeEventInDatabase(event);
      
      logger.info(`Tracked ${event.eventType} event for user ${event.userId}`, 'ProfileAnalyticsService');
      
    } catch (error) {
      logger.error(`Event tracking failed: ${error}`, 'ProfileAnalyticsService');
    }
  }
  
  /**
   * Track profile completion with timing
   */
  async trackProfileCompletion(userId: string, variant: string, completionTime: number): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'profile_complete',
      eventData: {
        abVariant: variant,
        completionTime
      },
      timestamp: new Date()
    });
  }
  
  /**
   * Track profile abandonment at specific step
   */
  async trackProfileAbandonment(userId: string, step: string, completionPercentage?: number): Promise<void> {
    const variant = await redisClient.get(`${this.AB_TEST_KEY}:${userId}`);
    
    await this.trackEvent({
      userId,
      eventType: 'profile_abandon',
      eventData: {
        step,
        abVariant: variant || 'unknown',
        profileCompletionPercentage: completionPercentage
      },
      timestamp: new Date()
    });
  }
  
  /**
   * Get comprehensive profile analytics
   */
  async getAnalytics(days = 30): Promise<ProfileAnalytics> {
    try {
      // Get date range
      const dates = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });
      
      // Get completion counts
      const completionKeys = dates.map(date => `${this.ANALYTICS_KEY}:profile_complete:${date}`);
      const completionCounts = await Promise.all(
        completionKeys.map(key => redisClient.get(key).then(v => parseInt(v || '0')))
      );
      
      const totalCompletions = completionCounts.reduce((sum, count) => sum + count, 0);
      
      // Get start counts for conversion rate
      const startKeys = dates.map(date => `${this.ANALYTICS_KEY}:profile_start:${date}`);
      const startCounts = await Promise.all(
        startKeys.map(key => redisClient.get(key).then(v => parseInt(v || '0')))
      );
      
      const totalStarts = startCounts.reduce((sum, count) => sum + count, 0);
      
      // Get total users from database
      const totalUsers = await this.getTotalUsersCount();
      
      // Calculate completion rate based on users who started the process
      const completionRate = totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;
      
      // Get average completion time
      const avgCompletionTime = await this.getAverageCompletionTime();
      
      // Get demographic breakdowns
      const [completionsByAge, completionsByGender, completionsByBodyType] = await Promise.all([
        this.getCompletionsByDemographic('age'),
        this.getCompletionsByDemographic('gender'),
        this.getCompletionsByDemographic('body_type')
      ]);
      
      // Get abandonment points
      const abandonmentPoints = await this.getAbandonmentPoints(dates);
      
      // Get A/B test results
      const abTestResults = await this.getABTestResults(dates);
      
      return {
        totalUsers,
        completedProfiles: totalCompletions,
        completionRate,
        avgCompletionTime,
        completionsByAge,
        completionsByGender,
        completionsByBodyType,
        abandonmentPoints,
        abTestResults
      };
      
    } catch (error) {
      logger.error(`Analytics retrieval failed: ${error}`, 'ProfileAnalyticsService');
      throw error;
    }
  }
  
  /**
   * Get A/B test performance results
   */
  async getABTestResults(dates: string[]): Promise<Record<string, ABTestResults>> {
    const results: Record<string, ABTestResults> = {};
    
    for (const variant of this.AB_VARIANTS) {
      const startKeys = dates.map(date => `${this.ANALYTICS_KEY}:profile_start:variant:${variant.id}:${date}`);
      const completionKeys = dates.map(date => `${this.ANALYTICS_KEY}:profile_complete:variant:${variant.id}:${date}`);
      
      const [startCounts, completionCounts] = await Promise.all([
        Promise.all(startKeys.map(key => redisClient.get(key).then(v => parseInt(v || '0')))),
        Promise.all(completionKeys.map(key => redisClient.get(key).then(v => parseInt(v || '0'))))
      ]);
      
      const totalStarts = startCounts.reduce((sum, count) => sum + count, 0);
      const totalCompletions = completionCounts.reduce((sum, count) => sum + count, 0);
      const completionRate = totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;
      
      results[variant.id] = {
        variant: variant.name,
        users: totalStarts,
        completions: totalCompletions,
        completionRate,
        avgCompletionTime: 0 // TODO: Calculate per-variant completion time
      };
    }
    
    return results;
  }
  
  /**
   * Store event in database for long-term analysis
   */
  private async storeEventInDatabase(event: ProfileAnalyticsEvent): Promise<void> {
    try {
      // TODO: Implement database storage
      // await storage.createProfileAnalyticsEvent({
      //   user_id: event.userId,
      //   event_type: event.eventType,
      //   event_data: JSON.stringify(event.eventData),
      //   ab_variant: event.eventData.abVariant,
      //   created_at: event.timestamp
      // });
    } catch (error) {
      logger.error(`Database event storage failed: ${error}`, 'ProfileAnalyticsService');
    }
  }
  
  private async getTotalUsersCount(): Promise<number> {
    try {
      // TODO: Implement proper database query
      return 1000; // Placeholder
    } catch (error) {
      logger.error(`Total users count failed: ${error}`, 'ProfileAnalyticsService');
      return 0;
    }
  }
  
  private async getAverageCompletionTime(): Promise<number> {
    try {
      // Get completion times from Redis
      const pattern = `${this.COMPLETION_TIME_KEY}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length === 0) return 0;
      
      const times = await Promise.all(
        keys.map(key => redisClient.get(key).then(v => parseFloat(v || '0')))
      );
      
      const validTimes = times.filter(time => time > 0);
      if (validTimes.length === 0) return 0;
      
      return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
      
    } catch (error) {
      logger.error(`Average completion time calculation failed: ${error}`, 'ProfileAnalyticsService');
      return 0;
    }
  }
  
  private async getCompletionsByDemographic(demographic: 'age' | 'gender' | 'body_type'): Promise<Record<string, number>> {
    try {
      // TODO: Implement database query for demographic breakdowns
      // This would join profile_analytics with users table to get demographic data
      return {}; // Placeholder
    } catch (error) {
      logger.error(`Demographic breakdown failed for ${demographic}: ${error}`, 'ProfileAnalyticsService');
      return {};
    }
  }
  
  private async getAbandonmentPoints(dates: string[]): Promise<Record<string, number>> {
    try {
      const steps = ['height', 'demographics', 'body-type', 'style-preferences'];
      const abandonmentPoints: Record<string, number> = {};
      
      for (const step of steps) {
        const stepKeys = dates.map(date => `${this.ANALYTICS_KEY}:abandonment:${step}:${date}`);
        const stepCounts = await Promise.all(
          stepKeys.map(key => redisClient.get(key).then(v => parseInt(v || '0')))
        );
        abandonmentPoints[step] = stepCounts.reduce((sum, count) => sum + count, 0);
      }
      
      return abandonmentPoints;
    } catch (error) {
      logger.error(`Abandonment points calculation failed: ${error}`, 'ProfileAnalyticsService');
      return {};
    }
  }
  
  /**
   * Generate daily analytics report
   */
  async generateDailyReport(): Promise<void> {
    try {
      const analytics = await this.getAnalytics(1); // Last 24 hours
      
      logger.info('=== Daily Profile Analytics Report ===', 'ProfileAnalyticsService');
      logger.info(`Total Users: ${analytics.totalUsers}`, 'ProfileAnalyticsService');
      logger.info(`Completed Profiles: ${analytics.completedProfiles}`, 'ProfileAnalyticsService');
      logger.info(`Completion Rate: ${analytics.completionRate.toFixed(1)}%`, 'ProfileAnalyticsService');
      logger.info(`Avg Completion Time: ${analytics.avgCompletionTime.toFixed(1)} hours`, 'ProfileAnalyticsService');
      
      // Log A/B test performance
      Object.entries(analytics.abTestResults).forEach(([variantId, results]) => {
        logger.info(`${results.variant}: ${results.completions}/${results.users} (${results.completionRate.toFixed(1)}%)`, 'ProfileAnalyticsService');
      });
      
    } catch (error) {
      logger.error(`Daily report generation failed: ${error}`, 'ProfileAnalyticsService');
    }
  }
}

export const profileAnalyticsService = new ProfileAnalyticsService();
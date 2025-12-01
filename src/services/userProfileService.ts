import { storage } from "../storage";
import { logger } from "../utils/winston-logger";
import { personAnalysisService, PersonProfile } from "./personAnalysisService";
import { UnitConverter, HeightMeasurement } from "../utils/unitConversion";
import { profileAnalyticsService } from "./profileAnalyticsService";

export interface UserPhysicalProfile {
  // Physical measurements
  heightFeet?: number; // 4-7
  heightInches?: number; // 0-11
  heightCentimeters?: number; // Metric height
  totalHeightInches?: number; // Calculated field
  
  // Demographics
  ageRange?: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  ethnicity?: string; // Free text for inclusive representation
  
  // Body characteristics
  bodyType?: 'slim' | 'average' | 'athletic' | 'plus-size';
  
  // Preferences
  stylePreferences?: string[]; // ['casual', 'formal', 'streetwear', 'bohemian', etc.]
  measurementSystem?: 'imperial' | 'metric';
  
  // Completion tracking
  profileCompleted?: boolean;
  profileCompletedAt?: Date;
}

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  completionPercentage: number;
  missingFields: string[];
}

export interface ProfileBenefitsData {
  accuracyImprovement: number; // Percentage improvement
  estimatedCreditsAved: number;
  personalizedFeatures: string[];
}

/**
 * User Profile Service
 * Manages user physical profiles with validation, conversion utilities,
 * and integration with PersonAnalysisService for hybrid AI + manual data
 */
export class UserProfileService {
  private readonly REQUIRED_FIELDS = ['heightFeet', 'heightInches', 'ageRange', 'gender', 'bodyType'];
  private readonly OPTIONAL_FIELDS = ['ethnicity', 'stylePreferences'];
  
  /**
   * Get user's physical profile
   */
  async getUserProfile(userId: string): Promise<UserPhysicalProfile | null> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        logger.warn(`User not found: ${userId}`, "UserProfileService");
        return null;
      }
      
      const profile: UserPhysicalProfile = {
        heightFeet: user.heightFeet || undefined,
        heightInches: user.heightInches || undefined,
        heightCentimeters: user.heightCentimeters || undefined,
        totalHeightInches: this.calculateTotalHeight(user.heightFeet, user.heightInches),
        ageRange: user.ageRange as UserPhysicalProfile['ageRange'] || undefined,
        gender: user.gender as UserPhysicalProfile['gender'] || undefined,
        ethnicity: user.ethnicity || undefined,
        bodyType: user.bodyType as UserPhysicalProfile['bodyType'] || undefined,
        stylePreferences: user.stylePreferences ? JSON.parse(JSON.stringify(user.stylePreferences)) : undefined,
        measurementSystem: user.measurementSystem as UserPhysicalProfile['measurementSystem'] || 'imperial',
        profileCompleted: user.profileCompleted || false,
        profileCompletedAt: user.profileCompletedAt || undefined,
      };
      
      logger.info(`Retrieved profile for user ${userId}`, "UserProfileService");
      return profile;
      
    } catch (error) {
      logger.error(`Failed to get user profile: ${error}`, "UserProfileService");
      throw error;
    }
  }
  
  /**
   * Update user's physical profile
   */
  async updateUserProfile(userId: string, profileData: Partial<UserPhysicalProfile>): Promise<UserPhysicalProfile> {
    try {
      // Validate the profile data
      const validation = this.validateProfile(profileData);
      
      // Calculate completion status
      const currentProfile = await this.getUserProfile(userId);
      const mergedProfile = { ...currentProfile, ...profileData };
      const completionValidation = this.validateProfile(mergedProfile);
      const isNowComplete = completionValidation.completionPercentage >= 80 && !currentProfile?.profileCompleted;
      
      // Convert between measurement systems if needed
      let heightData: any = {};
      if (profileData.measurementSystem === 'metric' && profileData.heightCentimeters) {
        const imperial = UnitConverter.centimetersToFeetInches(profileData.heightCentimeters);
        heightData = {
          heightFeet: imperial.feet,
          heightInches: imperial.inches,
          heightCentimeters: profileData.heightCentimeters
        };
      } else if (profileData.heightFeet !== undefined && profileData.heightInches !== undefined) {
        heightData = {
          heightFeet: profileData.heightFeet,
          heightInches: profileData.heightInches,
          heightCentimeters: UnitConverter.feetInchesToCentimeters(profileData.heightFeet, profileData.heightInches)
        };
      }
      
      // Prepare update data
      const updateData: any = {
        ...heightData,
        ageRange: profileData.ageRange,
        gender: profileData.gender,
        ethnicity: profileData.ethnicity,
        bodyType: profileData.bodyType,
        stylePreferences: profileData.stylePreferences ? JSON.stringify(profileData.stylePreferences) : undefined,
        measurementSystem: profileData.measurementSystem,
        profileCompleted: completionValidation.completionPercentage >= 80,
        profileCompletedAt: isNowComplete ? new Date() : undefined,
      };
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );
      
      // Update in database
      await storage.updateUser(userId, updateData);
      
      // If profile just became complete, award bonus credits and track completion
      if (isNowComplete) {
        await this.awardProfileCompletionBonus(userId);
        
        // Track profile completion for analytics
        const variant = await profileAnalyticsService.getABVariant(userId);
        await profileAnalyticsService.trackProfileCompletion(userId, variant.id, 0); // TODO: Calculate actual completion time
        
        logger.info(`Profile completed for user ${userId}, bonus credits awarded`, "UserProfileService");
      }
      
      // Return updated profile
      const updatedProfile = await this.getUserProfile(userId);
      logger.info(`Updated profile for user ${userId}`, "UserProfileService");
      return updatedProfile!;
      
    } catch (error) {
      logger.error(`Failed to update user profile: ${error}`, "UserProfileService");
      throw error;
    }
  }
  
  /**
   * Validate profile data and calculate completion percentage
   */
  validateProfile(profileData: Partial<UserPhysicalProfile>): ProfileValidationResult {
    const errors: string[] = [];
    const missingFields: string[] = [];
    let validFields = 0;
    const totalFields = this.REQUIRED_FIELDS.length + this.OPTIONAL_FIELDS.length;
    
    // Validate required fields
    for (const field of this.REQUIRED_FIELDS) {
      const value = profileData[field as keyof UserPhysicalProfile];
      if (!value && value !== 0) {
        missingFields.push(field);
      } else {
        validFields++;
        
        // Field-specific validation
        switch (field) {
          case 'heightFeet':
            if (typeof value === 'number' && (value < 4 || value > 7)) {
              errors.push("Height feet must be between 4 and 7");
            }
            break;
          case 'heightInches':
            if (typeof value === 'number' && (value < 0 || value > 11)) {
              errors.push("Height inches must be between 0 and 11");
            }
            break;
          case 'ageRange':
            const validAgeRanges = ['18-25', '26-35', '36-45', '46-55', '55+'];
            if (value && !validAgeRanges.includes(value as string)) {
              errors.push("Invalid age range");
            }
            break;
          case 'gender':
            const validGenders = ['male', 'female', 'non-binary', 'prefer-not-to-say'];
            if (value && !validGenders.includes(value as string)) {
              errors.push("Invalid gender option");
            }
            break;
          case 'bodyType':
            const validBodyTypes = ['slim', 'average', 'athletic', 'plus-size'];
            if (value && !validBodyTypes.includes(value as string)) {
              errors.push("Invalid body type");
            }
            break;
        }
      }
    }
    
    // Check optional fields
    for (const field of this.OPTIONAL_FIELDS) {
      const value = profileData[field as keyof UserPhysicalProfile];
      if (value) {
        validFields++;
        
        // Optional field validation
        if (field === 'ethnicity' && typeof value === 'string' && value.length < 2) {
          errors.push("Ethnicity must be at least 2 characters");
        }
      }
    }
    
    const completionPercentage = Math.round((validFields / totalFields) * 100);
    
    return {
      isValid: errors.length === 0,
      errors,
      completionPercentage,
      missingFields,
    };
  }
  
  /**
   * Get profile completion benefits for user motivation
   */
  getProfileBenefits(userId?: string): ProfileBenefitsData {
    return {
      accuracyImprovement: 85, // 85% more accurate try-ons
      estimatedCreditsAved: 15, // Save ~15 credits from fewer retries
      personalizedFeatures: [
        'Height-accurate garment fitting',
        'Age-appropriate style suggestions', 
        'Body-type optimized recommendations',
        'Ethnicity-aware skin tone matching',
        'Gender-specific fit adjustments'
      ]
    };
  }
  
  /**
   * Create hybrid AI + manual profile for rendering
   * Combines user profile data with AI analysis for maximum accuracy
   */
  async createHybridProfile(
    userId: string, 
    imageUrl?: string
  ): Promise<PersonProfile & { manualData: UserPhysicalProfile }> {
    try {
      // Get user's manual profile data
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        throw new Error("User profile not found");
      }
      
      // Get AI analysis if image provided
      let aiProfile: PersonProfile | null = null;
      if (imageUrl) {
        const analysisResult = await personAnalysisService.analyzePersonImage(userId, imageUrl);
        aiProfile = analysisResult.profile;
      }
      
      // Create hybrid profile prioritizing manual data
      const hybridProfile: PersonProfile & { manualData: UserPhysicalProfile } = {
        // Physical characteristics - prioritize manual data
        estimatedAge: this.ageRangeToNumber(userProfile.ageRange) || aiProfile?.estimatedAge,
        gender: (userProfile.gender === 'prefer-not-to-say' ? 'neutral' : userProfile.gender) as 'male' | 'female' | 'neutral' || aiProfile?.gender,
        ethnicity: userProfile.ethnicity || aiProfile?.ethnicity,
        skinTone: aiProfile?.skinTone, // AI is better for skin tone detection
        hairColor: aiProfile?.hairColor, // AI is better for visual features
        hairStyle: aiProfile?.hairStyle,
        eyeColor: aiProfile?.eyeColor,
        
        // Body metrics - prioritize manual data
        estimatedHeight: this.convertToInches(userProfile.heightFeet, userProfile.heightInches) || aiProfile?.estimatedHeight,
        buildType: userProfile.bodyType || aiProfile?.buildType,
        bodyShape: aiProfile?.bodyShape, // AI analysis for body shape
        
        // Style preferences - manual data
        preferredStyle: userProfile.stylePreferences?.join(', ') || aiProfile?.preferredStyle,
        faceShape: aiProfile?.faceShape, // AI is better for facial analysis
        facialFeatures: aiProfile?.facialFeatures || [],
        
        // Build comprehensive description
        detailedDescription: this.buildHybridDescription(userProfile, aiProfile),
        
        // Metadata
        imageHash: aiProfile?.imageHash || 'manual-profile',
        analyzedAt: new Date(),
        consentGiven: true,
        
        // Include manual data for reference
        manualData: userProfile,
      };
      
      logger.info(`Created hybrid profile for user ${userId}`, "UserProfileService");
      return hybridProfile;
      
    } catch (error) {
      logger.error(`Failed to create hybrid profile: ${error}`, "UserProfileService");
      throw error;
    }
  }
  
  /**
   * Convert height to total inches
   */
  private calculateTotalHeight(feet?: number, inches?: number): number | undefined {
    if (feet === undefined || inches === undefined) return undefined;
    return (feet * 12) + inches;
  }
  
  /**
   * Convert feet/inches to total inches
   */
  private convertToInches(feet?: number, inches?: number): number | undefined {
    if (feet === undefined || inches === undefined) return undefined;
    return (feet * 12) + inches;
  }
  
  /**
   * Convert user height between measurement systems
   */
  convertHeightSystem(
    profile: UserPhysicalProfile, 
    targetSystem: 'imperial' | 'metric'
  ): Partial<UserPhysicalProfile> {
    if (targetSystem === 'metric') {
      if (profile.heightFeet !== undefined && profile.heightInches !== undefined) {
        return {
          ...profile,
          heightCentimeters: UnitConverter.feetInchesToCentimeters(profile.heightFeet, profile.heightInches),
          measurementSystem: 'metric'
        };
      }
    } else {
      if (profile.heightCentimeters !== undefined) {
        const imperial = UnitConverter.centimetersToFeetInches(profile.heightCentimeters);
        return {
          ...profile,
          heightFeet: imperial.feet,
          heightInches: imperial.inches,
          measurementSystem: 'imperial'
        };
      }
    }
    return profile;
  }
  
  /**
   * Get formatted height display
   */
  getFormattedHeight(profile: UserPhysicalProfile): string {
    const measurement: HeightMeasurement = {
      feet: profile.heightFeet,
      inches: profile.heightInches,
      centimeters: profile.heightCentimeters
    };
    
    return UnitConverter.formatHeight(measurement, profile.measurementSystem || 'imperial');
  }
  
  /**
   * Convert age range to approximate number for AI
   */
  private ageRangeToNumber(ageRange?: string): number | undefined {
    switch (ageRange) {
      case '18-25': return 22;
      case '26-35': return 30;
      case '36-45': return 40;
      case '46-55': return 50;
      case '55+': return 60;
      default: return undefined;
    }
  }
  
  /**
   * Build comprehensive description from hybrid data
   */
  private buildHybridDescription(
    userProfile: UserPhysicalProfile, 
    aiProfile?: PersonProfile | null
  ): string {
    const parts: string[] = [];
    
    // Age and gender from user data
    if (userProfile.ageRange && userProfile.gender) {
      const ageNum = this.ageRangeToNumber(userProfile.ageRange);
      const genderText = userProfile.gender === 'prefer-not-to-say' ? 'person' : userProfile.gender;
      parts.push(`${ageNum}-year-old ${genderText}`);
    }
    
    // Ethnicity from user data
    if (userProfile.ethnicity) {
      parts.push(`${userProfile.ethnicity} person`);
    }
    
    // Height from user data
    if (userProfile.heightFeet && userProfile.heightInches !== undefined) {
      parts.push(`${userProfile.heightFeet}'${userProfile.heightInches}" tall`);
    }
    
    // Body type from user data
    if (userProfile.bodyType) {
      parts.push(`${userProfile.bodyType} build`);
    }
    
    // Visual features from AI (if available)
    if (aiProfile?.skinTone) {
      parts.push(`${aiProfile.skinTone} skin tone`);
    }
    
    if (aiProfile?.hairColor && aiProfile?.hairStyle) {
      parts.push(`${aiProfile.hairColor} ${aiProfile.hairStyle} hair`);
    }
    
    // Style preferences from user data
    if (userProfile.stylePreferences && userProfile.stylePreferences.length > 0) {
      parts.push(`prefers ${userProfile.stylePreferences.join(', ')} style`);
    }
    
    const description = parts.length > 0 ? parts.join(', ') : 'Person';
    
    // Add AI description if available for additional context
    if (aiProfile?.detailedDescription) {
      return `${description}. Additional details: ${aiProfile.detailedDescription}`;
    }
    
    return description;
  }
  
  /**
   * Award bonus credits for completing profile
   */
  private async awardProfileCompletionBonus(userId: string): Promise<void> {
    try {
      const BONUS_CREDITS = 5;
      const user = await storage.getUserById(userId);
      
      if (user) {
        await storage.updateUser(userId, {
          credits: user.credits + BONUS_CREDITS,
          creditsRemaining: user.creditsRemaining + BONUS_CREDITS,
        });
        
        logger.info(`Awarded ${BONUS_CREDITS} bonus credits to user ${userId} for profile completion`, "UserProfileService");
      }
    } catch (error) {
      logger.error(`Failed to award profile completion bonus: ${error}`, "UserProfileService");
    }
  }
  
  /**
   * Get users with incomplete profiles for targeting
   */
  async getUsersWithIncompleteProfiles(limit = 100): Promise<string[]> {
    try {
      // TODO: Implement database query for incomplete profiles
      // SELECT id FROM users WHERE profile_completed = false OR profile_completed IS NULL
      // LIMIT ${limit}
      
      logger.info(`Retrieved users with incomplete profiles`, "UserProfileService");
      return []; // Placeholder
    } catch (error) {
      logger.error(`Failed to get incomplete profile users: ${error}`, "UserProfileService");
      return [];
    }
  }
  
  /**
   * Get profile completion statistics
   */
  async getProfileCompletionStats(): Promise<{
    totalUsers: number;
    completedProfiles: number;
    completionRate: number;
    avgCompletionTime: number;
  }> {
    try {
      // TODO: Implement database aggregation queries
      return {
        totalUsers: 0,
        completedProfiles: 0,
        completionRate: 0,
        avgCompletionTime: 0,
      };
    } catch (error) {
      logger.error(`Failed to get profile completion stats: ${error}`, "UserProfileService");
      throw error;
    }
  }
}

export const userProfileService = new UserProfileService();
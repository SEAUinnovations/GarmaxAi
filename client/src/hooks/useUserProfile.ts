import { useState, useEffect } from 'react';

// API service for user profile management
class UserProfileApiService {
  private baseUrl = '/api/users';

  async getPhysicalProfile(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/profile/physical`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    return response.json();
  }

  async updatePhysicalProfile(profileData: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/profile/physical`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.statusText}`);
    }

    return response.json();
  }

  async getProfileBenefits(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/profile/benefits`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch benefits: ${response.statusText}`);
    }

    return response.json();
  }

  async getABVariant(): Promise<any> {
    const response = await fetch('/api/analytics/ab-variant', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch A/B variant: ${response.statusText}`);
    }

    return response.json();
  }

  async trackProfileEvent(eventType: string, eventData: any): Promise<void> {
    try {
      await fetch('/api/analytics/profile-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          eventType,
          eventData,
        }),
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
      // Don't throw - analytics failure shouldn't break user experience
    }
  }
}

export const userProfileApi = new UserProfileApiService();

// React hook for user profile management
export function useUserProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userProfileApi.getPhysicalProfile();
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: any) => {
    try {
      setLoading(true);
      setError(null);
      
      // Track profile start if not already tracking
      if (!profile?.profileCompleted) {
        await userProfileApi.trackProfileEvent('profile_start', {});
      }
      
      const data = await userProfileApi.updatePhysicalProfile(profileData);
      setProfile(data.profile);
      
      // Track completion if profile just became complete
      if (data.completedNow) {
        await userProfileApi.trackProfileEvent('profile_complete', {
          completionTime: 0, // TODO: Track actual time
        });
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const trackAbandonment = async (step: string, completionPercentage?: number) => {
    await userProfileApi.trackProfileEvent('profile_abandon', {
      step,
      profileCompletionPercentage: completionPercentage,
    });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile: fetchProfile,
    trackAbandonment,
  };
}

// React hook for profile benefits
export function useProfileBenefits() {
  const [benefits, setBenefits] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenefits = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await userProfileApi.getProfileBenefits();
        setBenefits(data.benefits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch benefits');
      } finally {
        setLoading(false);
      }
    };

    fetchBenefits();
  }, []);

  return { benefits, loading, error };
}

// React hook for A/B testing
export function useABTest() {
  const [variant, setVariant] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVariant = async () => {
      try {
        setLoading(true);
        const data = await userProfileApi.getABVariant();
        setVariant(data.variant);
      } catch (err) {
        console.warn('A/B test variant fetch failed:', err);
        // Use default variant on failure
        setVariant({
          id: 'control',
          name: 'Control',
          config: {
            showBenefits: true,
            bonusCredits: 5,
            formLayout: 'single-page',
            benefitsStyle: 'visual',
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVariant();
  }, []);

  return { variant, loading };
}

// Utility functions for unit conversion on frontend
export class FrontendUnitConverter {
  static feetInchesToCm(feet: number, inches: number): number {
    return Math.round(((feet * 12) + inches) * 2.54);
  }

  static cmToFeetInches(cm: number): { feet: number; inches: number } {
    const totalInches = Math.round(cm / 2.54);
    return {
      feet: Math.floor(totalInches / 12),
      inches: totalInches % 12,
    };
  }

  static formatHeight(feet?: number, inches?: number, cm?: number, system: 'imperial' | 'metric' = 'imperial'): string {
    if (system === 'metric') {
      if (cm) return `${cm} cm`;
      if (feet !== undefined && inches !== undefined) {
        return `${this.feetInchesToCm(feet, inches)} cm`;
      }
    } else {
      if (feet !== undefined && inches !== undefined) {
        return `${feet}'${inches}"`;
      }
      if (cm) {
        const { feet: f, inches: i } = this.cmToFeetInches(cm);
        return `${f}'${i}"`;
      }
    }
    return 'Not set';
  }

  static validateHeight(feet?: number, inches?: number, cm?: number, system: 'imperial' | 'metric' = 'imperial'): boolean {
    if (system === 'metric') {
      return cm !== undefined && cm >= 120 && cm <= 220;
    } else {
      return feet !== undefined && inches !== undefined && 
             feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11;
    }
  }
}

// Hook for form validation with unit conversion
export function useProfileValidation() {
  const validateProfile = (data: any) => {
    const errors: Record<string, string> = {};
    
    // Height validation
    if (data.measurementSystem === 'metric') {
      if (!data.heightCentimeters || data.heightCentimeters < 120 || data.heightCentimeters > 220) {
        errors.height = 'Height must be between 120-220 cm';
      }
    } else {
      if (!data.heightFeet || !data.heightInches || data.heightFeet < 4 || data.heightFeet > 7 || 
          data.heightInches < 0 || data.heightInches > 11) {
        errors.height = 'Please enter a valid height';
      }
    }
    
    // Required field validation
    const requiredFields = ['ageRange', 'gender', 'bodyType'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors[field] = 'This field is required';
      }
    });
    
    // Calculate completion percentage
    const totalFields = 6; // height, age, gender, body type, ethnicity, style preferences
    let completedFields = 0;
    
    if (FrontendUnitConverter.validateHeight(data.heightFeet, data.heightInches, data.heightCentimeters, data.measurementSystem)) {
      completedFields++;
    }
    if (data.ageRange) completedFields++;
    if (data.gender) completedFields++;
    if (data.bodyType) completedFields++;
    if (data.ethnicity && data.ethnicity.trim().length >= 2) completedFields++;
    if (data.stylePreferences && data.stylePreferences.length > 0) completedFields++;
    
    const completionPercentage = Math.round((completedFields / totalFields) * 100);
    
    return {
      errors,
      isValid: Object.keys(errors).length === 0,
      completionPercentage,
    };
  };
  
  return { validateProfile };
}
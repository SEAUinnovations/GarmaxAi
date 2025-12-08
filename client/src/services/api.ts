// Comprehensive API service layer for frontend-backend communication
import type { User, PhysicalProfile, TryonSession } from '../../../shared/schema';

/**
 * Custom API Error class for handling HTTP errors
 */
export class ApiError extends Error {
  constructor(
    public status: number, 
    message: string,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API response wrapper interface
 */
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Comprehensive API client for all backend communication
 * Provides type-safe methods for all API endpoints with proper error handling
 */
class ApiClient {
  private baseUrl = '/api';

  /**
   * Generic request method with error handling and type safety
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      ...options,
    };

    let response: Response;
    
    try {
      response = await fetch(url, config);
    } catch (error) {
      throw new ApiError(0, 'Network error: Unable to connect to server');
    }

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    let data: any;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (error) {
      data = { message: 'Invalid response format' };
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || response.statusText || 'Request failed';
      throw new ApiError(response.status, errorMessage, response);
    }

    return data as T;
  }

  // ===================
  // Authentication APIs
  // ===================

  /**
   * User login
   */
  async login(email: string, password: string): Promise<{ user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * User registration
   */
  async register(userData: { 
    username: string; 
    email: string; 
    password: string 
  }): Promise<{ user: User }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  /**
   * User logout
   */
  async logout(): Promise<{ message: string }> {
    return this.request('/auth/logout', { 
      method: 'POST' 
    });
  }

  /**
   * Start free trial
   */
  async startFreeTrial(email: string): Promise<{ message: string }> {
    return this.request('/auth/start-free-trial', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Verify trial email
   */
  async verifyTrialEmail(token: string, password: string): Promise<{ user: User }> {
    return this.request('/auth/verify-trial-email', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // =============
  // Profile APIs
  // =============

  /**
   * Get user's physical profile
   */
  async getPhysicalProfile(): Promise<PhysicalProfile | null> {
    return this.request('/users/profile/physical');
  }

  /**
   * Update or create physical profile
   */
  async updatePhysicalProfile(profile: Partial<PhysicalProfile>): Promise<PhysicalProfile> {
    return this.request('/users/profile/physical', {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
  }

  /**
   * Get profile completion benefits
   */
  async getProfileBenefits(): Promise<{ 
    completionPercentage: number; 
    benefits: string[] 
  }> {
    return this.request('/users/profile/benefits');
  }

  /**
   * Get user profile summary
   */
  async getUserProfile(): Promise<User> {
    return this.request('/users/profile');
  }

  // ===============
  // Analytics APIs
  // ===============

  /**
   * Get A/B test variant for current user
   */
  async getABVariant(): Promise<{ 
    variant: string; 
    userId: string;
    assignedAt: string;
  }> {
    return this.request('/analytics/ab-variant');
  }

  /**
   * Track profile-related event
   */
  async trackProfileEvent(event: { 
    type: string; 
    data?: any;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean }> {
    return this.request('/analytics/profile-event', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  /**
   * Track profile abandonment
   */
  async trackProfileAbandonment(data: {
    completionPercentage: number;
    timeSpent: number;
    lastField?: string;
  }): Promise<{ success: boolean }> {
    return this.request('/analytics/profile-abandonment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===================
  // Try-on Session APIs
  // ===================

  /**
   * Create new try-on session
   */
  async createTryonSession(sessionData: {
    photoId: string;
    garmentIds: string[];
    preferences: {
      renderQuality: 'sd' | 'hd' | '4k';
      backgroundScene?: string;
      customBackgroundPrompt?: string;
    };
  }): Promise<TryonSession> {
    return this.request('/tryon/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  /**
   * Get try-on session status
   */
  async getTryonSessionStatus(sessionId: string): Promise<TryonSession> {
    return this.request(`/tryon/sessions/${sessionId}/status`);
  }

  /**
   * Get user's try-on sessions
   */
  async getUserTryonSessions(limit?: number, offset?: number): Promise<{
    sessions: TryonSession[];
    total: number;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    return this.request(`/tryon/sessions?${params.toString()}`);
  }

  /**
   * Cancel try-on session
   */
  async cancelTryonSession(sessionId: string): Promise<{ 
    message: string;
    refundedCredits?: number;
  }> {
    return this.request(`/tryon/sessions/${sessionId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Confirm try-on preview
   */
  async confirmTryonPreview(sessionId: string, approved: boolean): Promise<TryonSession> {
    return this.request(`/tryon/sessions/${sessionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ approveOverlay: approved }),
    });
  }

  // =============
  // Credits APIs
  // =============

  /**
   * Get user's credit balance and usage
   */
  async getCredits(): Promise<{ 
    balance: number; 
    monthlyQuota: number; 
    used: number;
    resetDate?: string;
  }> {
    return this.request('/credits');
  }

  // =============
  // Avatar APIs
  // =============

  /**
   * Get user's avatars
   */
  async getUserAvatars(): Promise<{
    avatars: Array<{
      id: string;
      name: string;
      thumbnailUrl: string | null;
      createdAt: string;
      isDemo: boolean;
    }>;
    limit: number;
    used: number;
  }> {
    return this.request('/tryon/avatars');
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(avatarId: string): Promise<{ message: string }> {
    return this.request(`/tryon/avatars/${avatarId}`, {
      method: 'DELETE',
    });
  }

  // ==============
  // Garment APIs
  // ==============

  /**
   * Get user's wardrobe
   */
  async getWardrobe(): Promise<{
    garments: Array<{
      id: string;
      name: string;
      type: string;
      imageUrl: string;
      isOverlayable: boolean;
    }>;
  }> {
    return this.request('/tryon/garment/wardrobe');
  }

  /**
   * Analyze garment from URL
   */
  async analyzeGarmentFromUrl(imageUrl: string): Promise<{
    id: string;
    name: string;
    type: string;
    color: string;
    isOverlayable: boolean;
  }> {
    return this.request('/tryon/garment/analyze-url', {
      method: 'POST',
      body: JSON.stringify({ imageUrl }),
    });
  }

  // =============
  // Health APIs
  // =============

  /**
   * Get API health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    services: Record<string, string>;
  }> {
    return this.request('/health');
  }

  // ====================
  // File Upload Helpers
  // ====================

  /**
   * Upload file with progress tracking
   */
  async uploadFile(
    endpoint: string, 
    file: File, 
    additionalData?: Record<string, string>,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add additional form data
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            resolve(xhr.responseText);
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.message || errorMessage;
          } catch (error) {
            errorMessage = xhr.statusText || errorMessage;
          }
          reject(new ApiError(xhr.status, errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError(0, 'Network error during upload'));
      });

      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for convenience
export type { User, PhysicalProfile, TryonSession };
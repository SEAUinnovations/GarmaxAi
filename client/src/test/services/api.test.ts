// Integration tests for the centralized API service layer
import { describe, test, beforeEach, expect, vi } from 'vitest';
import { apiClient, ApiError } from '../../services/api';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as any;

describe('API Service Layer', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
        subscriptionTier: 'free',
        credits: 10
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ user: mockUser })
      } as unknown as Response);

      const result = await apiClient.login('test@example.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });

      expect(result.user).toEqual(mockUser);
    });

    test('should throw ApiError for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'Invalid credentials' })
      } as unknown as Response);

      await expect(apiClient.login('test@example.com', 'wrongpassword'))
        .rejects
        .toThrow(ApiError);

      await expect(apiClient.login('test@example.com', 'wrongpassword'))
        .rejects
        .toMatchObject({
          status: 401,
          message: 'Invalid credentials'
        });
    });

    test('should register new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'securepass123'
      };

      const mockUser = {
        id: 'user_456',
        ...userData,
        subscriptionTier: 'free',
        credits: 5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ user: mockUser })
      } as unknown as Response);

      const result = await apiClient.register(userData);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });

      expect(result.user.username).toBe('newuser');
      expect(result.user.email).toBe('new@example.com');
    });

    test('should logout successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Logged out successfully' })
      } as unknown as Response);

      const result = await apiClient.logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('Physical Profile', () => {
    test('should get physical profile successfully', async () => {
      const mockProfile = {
        userId: 'user_123',
        measurementSystem: 'imperial' as const,
        height: 70,
        weight: 150,
        bodyType: 'hourglass' as const,
        chest: 36,
        waist: 28,
        hips: 38,
        completionPercentage: 85
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockProfile
      } as unknown as Response);

      const result = await apiClient.getPhysicalProfile();

      expect(mockFetch).toHaveBeenCalledWith('/api/users/profile/physical', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result).toEqual(mockProfile);
    });

    test('should update physical profile successfully', async () => {
      const profileUpdate = {
        height: 68,
        weight: 140,
        bodyType: 'pear' as const
      };

      const mockUpdatedProfile = {
        userId: 'user_123',
        measurementSystem: 'imperial' as const,
        ...profileUpdate,
        completionPercentage: 90
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockUpdatedProfile
      } as unknown as Response);

      const result = await apiClient.updatePhysicalProfile(profileUpdate);

      expect(mockFetch).toHaveBeenCalledWith('/api/users/profile/physical', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profileUpdate)
      });

      expect(result.height).toBe(68);
      expect(result.bodyType).toBe('pear');
    });
  });

  describe('Try-on Sessions', () => {
    test('should create try-on session successfully', async () => {
      const sessionData = {
        photoId: 'photo_123',
        garmentIds: ['garment_456', 'garment_789'],
        preferences: {
          renderQuality: 'hd' as const,
          backgroundScene: 'studio'
        }
      };

      const mockSession = {
        id: 'session_123',
        userId: 'user_123',
        status: 'queued' as const,
        progress: 0,
        renderQuality: 'hd' as const,
        backgroundScene: 'studio',
        creditsUsed: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockSession
      } as unknown as Response);

      const result = await apiClient.createTryonSession(sessionData);

      expect(mockFetch).toHaveBeenCalledWith('/api/tryon/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(sessionData)
      });

      expect(result.id).toBe('session_123');
      expect(result.status).toBe('queued');
    });

    test('should get try-on session status', async () => {
      const sessionId = 'session_123';
      const mockSession = {
        id: sessionId,
        userId: 'user_123',
        status: 'completed' as const,
        progress: 100,
        renderQuality: 'hd' as const,
        renderedImageUrl: 'https://example.com/result.jpg',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T01:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockSession
      } as unknown as Response);

      const result = await apiClient.getTryonSessionStatus(sessionId);

      expect(mockFetch).toHaveBeenCalledWith(`/api/tryon/sessions/${sessionId}/status`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    test('should cancel try-on session', async () => {
      const sessionId = 'session_123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ 
          message: 'Session cancelled successfully',
          refundedCredits: 3 
        })
      } as unknown as Response);

      const result = await apiClient.cancelTryonSession(sessionId);

      expect(mockFetch).toHaveBeenCalledWith(`/api/tryon/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result.message).toBe('Session cancelled successfully');
      expect(result.refundedCredits).toBe(3);
    });
  });

  describe('Credits', () => {
    test('should get credit balance', async () => {
      const mockCredits = {
        balance: 45,
        monthlyQuota: 100,
        used: 55,
        resetDate: '2024-02-01T00:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockCredits
      } as unknown as Response);

      const result = await apiClient.getCredits();

      expect(mockFetch).toHaveBeenCalledWith('/api/credits', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result.balance).toBe(45);
      expect(result.monthlyQuota).toBe(100);
    });
  });

  describe('Analytics', () => {
    test('should get A/B test variant', async () => {
      const mockVariant = {
        variant: 'higher_bonus',
        userId: 'user_123',
        assignedAt: '2024-01-01T00:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockVariant
      } as unknown as Response);

      const result = await apiClient.getABVariant();

      expect(result.variant).toBe('higher_bonus');
      expect(result.userId).toBe('user_123');
    });

    test('should track profile event', async () => {
      const eventData = {
        type: 'field_completed',
        data: { field: 'height', value: '70' },
        metadata: { browser: 'Chrome' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, eventId: 'evt_456' })
      } as unknown as Response);

      const result = await apiClient.trackProfileEvent(eventData);

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/profile-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(eventData)
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.getCurrentUser())
        .rejects
        .toThrow('Network error: Unable to connect to server');
    });

    test('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => 'text/html' },
        text: async () => 'Internal Server Error',
        statusText: 'Internal Server Error'
      } as unknown as Response);

      await expect(apiClient.getCurrentUser())
        .rejects
        .toMatchObject({
          status: 500,
          message: 'Internal Server Error'
        });
    });

    test('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => { throw new Error('Invalid JSON'); }
      } as unknown as Response);

      await expect(apiClient.getCurrentUser())
        .rejects
        .toThrow('Invalid response format');
    });
  });

  describe('File Upload', () => {
    test('should upload file with progress tracking', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const mockProgressCallback = vi.fn();

      // Mock XMLHttpRequest
      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        send: vi.fn(),
        withCredentials: false,
        status: 200,
        responseText: JSON.stringify({ fileUrl: 'https://example.com/uploaded.jpg' })
      };

      // Mock the upload success
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          callback();
        }
      });

      global.XMLHttpRequest = vi.fn(() => mockXHR) as any;

      const result = await apiClient.uploadFile('/upload', mockFile, { type: 'avatar' }, mockProgressCallback);

      expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/upload');
      expect(result).toEqual({ fileUrl: 'https://example.com/uploaded.jpg' });
    });
  });
});

describe('ApiError', () => {
  test('should create ApiError with status and message', () => {
    const error = new ApiError(404, 'Not found');
    
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.name).toBe('ApiError');
  });

  test('should create ApiError with response object', () => {
    const mockResponse = { status: 400 } as Response;
    const error = new ApiError(400, 'Bad request', mockResponse);
    
    expect(error.response).toBe(mockResponse);
  });
});
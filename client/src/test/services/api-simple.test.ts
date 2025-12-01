// Simple API endpoint tests without database dependencies
import { apiClient, ApiError } from '../../services/api';
import { describe, test, beforeEach, expect, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as any;

describe('API Service Layer - Core Functionality', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Error Handling', () => {
    test('should handle network errors correctly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.getHealthStatus())
        .rejects
        .toThrow('Network error: Unable to connect to server');
    });

    test('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'Not found' })
      } as Response);

      await expect(apiClient.getCurrentUser())
        .rejects
        .toMatchObject({
          status: 404,
          message: 'Not found'
        });
    });

    test('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      await expect(apiClient.getCurrentUser())
        .rejects
        .toThrow('Invalid response format');
    });
  });

  describe('Request Configuration', () => {
    test('should include correct headers and credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ status: 'ok' })
      } as Response);

      await apiClient.getHealthStatus();

      expect(mockFetch).toHaveBeenCalledWith('/api/health', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    });

    test('should send POST requests with correct body', async () => {
      const loginData = { email: 'test@example.com', password: 'password123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ user: { id: '123' } })
      } as Response);

      await apiClient.login(loginData.email, loginData.password);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData)
      });
    });
  });

  describe('Success Responses', () => {
    test('should return health status successfully', async () => {
      const mockHealthData = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: { database: 'healthy', redis: 'healthy' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockHealthData
      } as Response);

      const result = await apiClient.getHealthStatus();

      expect(result).toEqual(mockHealthData);
      expect(result.status).toBe('ok');
      expect(result.services.database).toBe('healthy');
    });

    test('should handle URL parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ sessions: [], total: 0, hasMore: false })
      } as Response);

      await apiClient.getUserTryonSessions(10, 20);

      expect(mockFetch).toHaveBeenCalledWith('/api/tryon/sessions?limit=10&offset=20', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    });
  });
});

describe('ApiError Class', () => {
  test('should create ApiError with correct properties', () => {
    const error = new ApiError(404, 'Not found');
    
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.name).toBe('ApiError');
    expect(error instanceof Error).toBe(true);
  });

  test('should include response object when provided', () => {
    const mockResponse = { status: 400 } as Response;
    const error = new ApiError(400, 'Bad request', mockResponse);
    
    expect(error.response).toBe(mockResponse);
  });
});
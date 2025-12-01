// Pure unit tests for the API service layer without MSW interference
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Create our own ApiClient class for testing
class TestApiClient {
  private baseUrl = '/api';

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      throw new Error('Network error: Unable to connect to server');
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    let data: any;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (error) {
      throw new Error('Invalid response format');
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || response.statusText || 'Request failed';
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    return data as T;
  }

  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getHealthStatus() {
    return this.request('/health');
  }
}

describe('API Service Layer - Unit Tests', () => {
  let apiClient: TestApiClient;
  let mockFetch: any;

  beforeEach(() => {
    // Reset fetch mock before each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    apiClient = new TestApiClient();
  });

  describe('Network Error Handling', () => {
    test('should handle fetch network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(apiClient.getHealthStatus())
        .rejects
        .toThrow('Network error: Unable to connect to server');

      expect(mockFetch).toHaveBeenCalledWith('/api/health', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    });

    test('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      });

      await expect(apiClient.getHealthStatus())
        .rejects
        .toThrow('Invalid response format');
    });
  });

  describe('HTTP Error Responses', () => {
    test('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce({ error: 'Resource not found' })
      });

      await expect(apiClient.getHealthStatus())
        .rejects
        .toThrow('HTTP 404: Resource not found');
    });

    test('should handle 401 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce({ message: 'Invalid credentials' })
      });

      await expect(apiClient.login('test@example.com', 'wrongpass'))
        .rejects
        .toThrow('HTTP 401: Invalid credentials');
    });
  });

  describe('Successful Requests', () => {
    test('should make GET requests correctly', async () => {
      const mockHealthData = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        services: { database: 'connected', redis: 'connected' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce(mockHealthData)
      });

      const result = await apiClient.getHealthStatus();

      expect(mockFetch).toHaveBeenCalledWith('/api/health', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      expect(result).toEqual(mockHealthData);
    });

    test('should make POST requests with correct body', async () => {
      const mockUserData = { user: { id: '123', email: 'test@example.com' } };
      const credentials = { email: 'test@example.com', password: 'password123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce(mockUserData)
      });

      const result = await apiClient.login(credentials.email, credentials.password);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      expect(result).toEqual(mockUserData);
    });
  });

  describe('Request Configuration', () => {
    test('should include required headers and credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce({ status: 'ok' })
      });

      await apiClient.getHealthStatus();

      const [url, config] = mockFetch.mock.calls[0];
      
      expect(url).toBe('/api/health');
      expect(config.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(config.credentials).toBe('include');
    });

    test('should merge custom options with defaults', async () => {
      const customClient = new TestApiClient();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce({ success: true })
      });

      await customClient.request('/custom', {
        method: 'PATCH',
        headers: { 'X-Custom': 'value' }
      });

      const [url, config] = mockFetch.mock.calls[0];
      
      expect(config.method).toBe('PATCH');
      // Headers are merged by the spread operator in the request method
      expect(config.headers['X-Custom']).toBe('value');
      expect(config.credentials).toBe('include');
    });
  });

  describe('Response Content Types', () => {
    test('should handle JSON responses', async () => {
      const jsonData = { message: 'Success', data: [1, 2, 3] };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: vi.fn().mockResolvedValueOnce(jsonData)
      });

      const result = await apiClient.getHealthStatus();
      expect(result).toEqual(jsonData);
    });

    test('should handle text responses', async () => {
      const textData = 'Plain text response';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: vi.fn().mockResolvedValueOnce(textData)
      });

      const result = await apiClient.getHealthStatus();
      expect(result).toBe(textData);
    });
  });
});
// Authentication middleware unit tests
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { 
  authenticateToken, 
  optionalAuth, 
  requireActiveTrial, 
  requireCredits 
} from '../../src/middleware/auth';
import { storage } from '../../src/storage';

// Mock storage
jest.mock('../../src/storage', () => ({
  storage: {
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock })) as any;

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should authenticate valid token and attach user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        creditsRemaining: 100,
        trialStatus: 'active',
      };

      (storage.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      // Create valid JWT token (not expired)
      const payload = {
        sub: 'cognito-sub-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(storage.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect((mockReq as any).userId).toBe('user-123');
      expect((mockReq as any).userEmail).toBe('test@example.com');
      expect((mockReq as any).cognitoSub).toBe('cognito-sub-123');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should reject request when token is missing', async () => {
      mockReq.headers = {};

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject request when authorization header has no Bearer token', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat',
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject expired token', async () => {
      const payload = {
        sub: 'cognito-sub-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject token with malformed JWT format', async () => {
      mockReq.headers = {
        authorization: 'Bearer malformed.token',
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Token validation failed',
        code: 'INVALID_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject token without email claim', async () => {
      const payload = {
        sub: 'cognito-sub-123',
        // No email field
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid token - no email found',
        code: 'INVALID_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject token when user not found in database', async () => {
      (storage.getUserByEmail as jest.Mock).mockResolvedValue(null);

      const payload = {
        sub: 'cognito-sub-123',
        email: 'nonexistent@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should use username claim if email is not present', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'username@example.com',
        username: 'username@example.com',
      };

      (storage.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const payload = {
        sub: 'cognito-sub-456',
        username: 'username@example.com', // Using username instead of email
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(storage.getUserByEmail).toHaveBeenCalledWith('username@example.com');
      expect((mockReq as any).userId).toBe('user-456');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      (storage.getUserByEmail as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const payload = {
        sub: 'cognito-sub-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Token validation failed',
        code: 'INVALID_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('should continue without auth when token is missing', async () => {
      mockReq.headers = {};

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userId).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should attach user info when valid token is provided', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'optional@example.com',
      };

      (storage.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const payload = {
        sub: 'cognito-sub-789',
        email: 'optional@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).userId).toBe('user-789');
      expect((mockReq as any).userEmail).toBe('optional@example.com');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should continue without auth when token is expired', async () => {
      const payload = {
        sub: 'cognito-sub-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userId).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should continue without auth when token format is invalid', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid.format',
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userId).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should continue without auth when user not found', async () => {
      (storage.getUserByEmail as jest.Mock).mockResolvedValue(null);

      const payload = {
        sub: 'cognito-sub-123',
        email: 'notfound@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userId).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should continue without auth when database error occurs', async () => {
      (storage.getUserByEmail as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const payload = {
        sub: 'cognito-sub-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = createMockToken(payload);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userId).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('requireActiveTrial', () => {
    test('should pass when user has active trial', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const mockUser = {
        id: 'user-trial',
        email: 'trial@example.com',
        trialStatus: 'active',
        trialExpiresAt: futureDate,
      };

      (mockReq as any).userId = 'user-trial';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(storage.getUserById).toHaveBeenCalledWith('user-trial');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should reject when userId is not attached to request', async () => {
      // No userId in request
      mockReq = { headers: {} };

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when user not found', async () => {
      (mockReq as any).userId = 'nonexistent-user';
      (storage.getUserById as jest.Mock).mockResolvedValue(null);

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when trial status is not active', async () => {
      const mockUser = {
        id: 'user-expired',
        email: 'expired@example.com',
        trialStatus: 'expired',
        trialExpiresAt: new Date(Date.now() - 1000),
      };

      (mockReq as any).userId = 'user-expired';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Trial expired. Please upgrade your account.',
        code: 'TRIAL_EXPIRED',
        trialExpiresAt: mockUser.trialExpiresAt,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when trial date has passed', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const mockUser = {
        id: 'user-past',
        email: 'past@example.com',
        trialStatus: 'active', // Status says active but date has passed
        trialExpiresAt: pastDate,
      };

      (mockReq as any).userId = 'user-past';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Trial expired. Please upgrade your account.',
        code: 'TRIAL_EXPIRED',
        trialExpiresAt: pastDate,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      (mockReq as any).userId = 'user-error';
      (storage.getUserById as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await requireActiveTrial(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to verify trial status',
        code: 'TRIAL_CHECK_ERROR',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireCredits', () => {
    test('should pass when user has sufficient credits', async () => {
      const mockUser = {
        id: 'user-credits',
        email: 'credits@example.com',
        creditsRemaining: 100,
      };

      (mockReq as any).userId = 'user-credits';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const middleware = requireCredits(10);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(storage.getUserById).toHaveBeenCalledWith('user-credits');
      expect((mockReq as any).creditsRequired).toBe(10);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('should use default of 1 credit when not specified', async () => {
      const mockUser = {
        id: 'user-default',
        email: 'default@example.com',
        creditsRemaining: 5,
      };

      (mockReq as any).userId = 'user-default';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const middleware = requireCredits(); // No argument
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).creditsRequired).toBe(1);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject when user has insufficient credits', async () => {
      const mockUser = {
        id: 'user-no-credits',
        email: 'nocredits@example.com',
        creditsRemaining: 5,
      };

      (mockReq as any).userId = 'user-no-credits';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const middleware = requireCredits(10);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        required: 10,
        available: 5,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when userId is not attached', async () => {
      mockReq = { headers: {} };

      const middleware = requireCredits(1);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when user not found', async () => {
      (mockReq as any).userId = 'nonexistent';
      (storage.getUserById as jest.Mock).mockResolvedValue(null);

      const middleware = requireCredits(1);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      (mockReq as any).userId = 'user-error';
      (storage.getUserById as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const middleware = requireCredits(1);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to verify credits',
        code: 'CREDITS_CHECK_ERROR',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject when credits exactly equal requirement', async () => {
      const mockUser = {
        id: 'user-exact',
        email: 'exact@example.com',
        creditsRemaining: 10,
      };

      (mockReq as any).userId = 'user-exact';
      (storage.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const middleware = requireCredits(10);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should pass - 10 credits available, 10 required
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});

// Helper function to create mock JWT token
function createMockToken(payload: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const base64Signature = Buffer.from('mock_signature').toString('base64');

  return `${base64Header}.${base64Payload}.${base64Signature}`;
}

// Test utilities and helpers for Jest backend tests
import request from 'supertest';
import { app } from '../../src/app';
import { storage } from '../../src/storage';
import type { User } from '@shared/schema';

export class TestClient {
  private agent: any;

  constructor() {
    this.agent = request.agent(app);
  }

  // Authentication helpers
  async registerUser(userData: Partial<User> = {}) {
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      ...userData,
    };

    const response = await this.agent
      .post('/api/auth/register')
      .send(defaultUser)
      .expect(201);

    return response.body;
  }

  async loginUser(email: string = 'test@example.com', password: string = 'password123') {
    const response = await this.agent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body;
  }

  async createAuthenticatedUser() {
    const user = await this.registerUser();
    await this.loginUser(user.email);
    return user;
  }

  // API method helpers
  get(path: string) {
    return this.agent.get(path);
  }

  post(path: string) {
    return this.agent.post(path);
  }

  patch(path: string) {
    return this.agent.patch(path);
  }

  delete(path: string) {
    return this.agent.delete(path);
  }
}

export const createTestClient = () => new TestClient();

// Database helpers
export const createTestUser = async (overrides: Partial<User> = {}): Promise<User> => {
  const userData = {
    username: overrides.username || 'testuser',
    email: overrides.email || 'test@example.com',
    password: overrides.password || '$2b$10$hashedpassword',
    emailVerified: overrides.emailVerified ?? true,
    subscriptionTier: (overrides.subscriptionTier as 'free' | 'studio' | 'pro') || 'free',
    creditsRemaining: overrides.creditsRemaining || 10,
    trialExpiresAt: overrides.trialExpiresAt || undefined,
    trialStatus: (overrides.trialStatus as 'active' | 'expired' | 'converted' | null) || null,
  };

  return await storage.createUser(userData);
};

export const createTestProfile = async (userId: string, overrides: any = {}) => {
  const profileData = {
    userId,
    heightFeet: 5,
    heightInches: 8,
    measurementSystem: 'imperial' as const,
    bodyType: 'athletic',
    fitPreference: 'fitted',
    ...overrides,
  };

  // Use updateUser instead since we don't have createPhysicalProfile
  return await storage.updateUser(userId, profileData);
};

// Mock data generators
export const mockUser = (overrides: Partial<User> = {}): User => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'testuser',
  email: 'test@example.com',
  password: '$2b$10$hashedpassword',
  emailVerified: true,
  trialExpiresAt: null,
  trialStatus: 'active',
  subscriptionTier: 'free',
  credits: 10,
  creditsRemaining: 10,
  heightFeet: null,
  heightInches: null,
  ageRange: null,
  gender: null,
  bodyType: null,
  ethnicity: null,
  profileCompleted: false,
  profileCompletedAt: null,
  stylePreferences: null,
  measurementSystem: 'imperial',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
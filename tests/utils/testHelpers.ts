// Test utilities and helpers for Jest backend tests
import request from 'supertest';
import { app } from '../../src/app';
import { storage } from '../../src/storage';
import type { User, PhysicalProfile } from '@shared/schema';

export class TestClient {
  private agent: request.SuperAgentTest;

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
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    emailVerified: true,
    subscriptionTier: 'free' as const,
    credits: 10,
    ...overrides,
  };

  return await storage.createUser(userData);
};

export const createTestProfile = async (userId: string, overrides: Partial<PhysicalProfile> = {}) => {
  const profileData = {
    userId,
    heightFeet: 5,
    heightInches: 8,
    measurementSystem: 'imperial' as const,
    bodyType: 'athletic',
    fitPreference: 'fitted',
    ...overrides,
  };

  return await storage.createPhysicalProfile(profileData);
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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
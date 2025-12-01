// Global test setup for Jest backend tests
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { storage } from '../src/storage';

// Global test setup
beforeAll(async () => {
  // Initialize test database connection
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://root:password@localhost:3306/garmaxai_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  
  // Set up test storage
  try {
    await storage.initialize();
    console.log('✓ Test database initialized');
  } catch (error) {
    console.warn('Test database initialization skipped:', error.message);
  }
});

afterAll(async () => {
  // Clean up connections
  try {
    await storage.disconnect();
    console.log('✓ Test database disconnected');
  } catch (error) {
    console.error('Error disconnecting test database:', error);
  }
});

beforeEach(async () => {
  // Clear test data before each test
  try {
    if (storage.clearTestData) {
      await storage.clearTestData();
    }
  } catch (error) {
    // If clearTestData doesn't exist, it's okay for now
    console.warn('clearTestData method not implemented in storage');
  }
});

afterEach(async () => {
  // Clean up after each test
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);
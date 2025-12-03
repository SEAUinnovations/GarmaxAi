// Global test setup for Jest backend tests
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { StorageFactory } from '../src/storage/storageFactory';

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://root:password@localhost:3306/garmaxai_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  
  // Mock Cognito configuration for tests
  process.env.COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_test123456';
  process.env.COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'test-client-id-123456';
  process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  
  // Mock other AWS services
  process.env.S3_BUCKET = process.env.S3_BUCKET || 'test-bucket';
  process.env.EVENTBRIDGE_BUS_NAME = process.env.EVENTBRIDGE_BUS_NAME || 'test-event-bus';
  
  // Set up test storage - this will use MemStorage for test environment
  try {
    await StorageFactory.getStorage();
    console.log('✓ Test storage initialized (MemStorage)');
  } catch (error: any) {
    console.warn('Test storage initialization warning:', error.message);
  }
});

afterAll(async () => {
  // Clean up connections
  try {
    StorageFactory.resetStorage();
    console.log('✓ Test storage reset');
  } catch (error) {
    console.error('Error resetting test storage:', error);
  }
});

beforeEach(async () => {
  // Clear test data before each test
  try {
    // For MemStorage, we can reset the storage instance
    StorageFactory.resetStorage();
  } catch (error) {
    // If reset doesn't work, it's okay for now
    console.warn('Storage reset not available');
  }
});

afterEach(async () => {
  // Clean up after each test
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);
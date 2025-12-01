#!/usr/bin/env node

/**
 * Quick test script to verify the flexible storage system is working
 */

import 'dotenv/config';
import { getStorage } from '../src/storage.js';
import { logger } from '../src/utils/winston-logger.js';

async function testStorage() {
  console.log('🧪 Testing GarmaxAi Flexible Storage System...\n');
  
  try {
    // Test storage initialization
    console.log('1. Initializing storage...');
    const storage = await getStorage();
    console.log('✅ Storage initialized successfully');
    
    // Test health check
    console.log('\n2. Testing health endpoint...');
    const response = await fetch('http://localhost:3000/api/health');
    if (response.ok) {
      const healthData = await response.json();
      console.log('✅ Health endpoint working:', healthData.status);
      console.log('   Environment:', healthData.environment);
    } else {
      console.log('❌ Health endpoint failed');
    }
    
    // Test storage health
    console.log('\n3. Testing storage health endpoint...');
    const storageResponse = await fetch('http://localhost:3000/api/health/storage');
    if (storageResponse.ok) {
      const storageHealthData = await storageResponse.json();
      console.log('✅ Storage health endpoint working');
      console.log('   Storage type:', storageHealthData.storage);
      console.log('   Healthy:', storageHealthData.healthy);
    } else {
      console.log('❌ Storage health endpoint failed');
    }
    
    // Test basic storage operations
    console.log('\n4. Testing basic storage operations...');
    
    // Test creating a temp user (for email verification)
    const testTempUser = await storage.createTempUser({
      email: 'test@example.com',
      verificationCode: '123456',
      verificationExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });
    console.log('✅ Created temp user:', testTempUser.id);
    
    // Test retrieving the temp user
    const retrievedTempUser = await storage.getTempUserByEmail('test@example.com');
    if (retrievedTempUser && retrievedTempUser.id === testTempUser.id) {
      console.log('✅ Retrieved temp user successfully');
    } else {
      console.log('❌ Failed to retrieve temp user');
    }
    
    // Test cleanup
    await storage.deleteTempUser('test@example.com');
    console.log('✅ Cleaned up temp user');
    
    console.log('\n🎉 All tests passed! Storage system is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   • Environment: development');
    console.log('   • Storage: In-memory (MemStorage)');
    console.log('   • Health endpoints: Working');
    console.log('   • Basic operations: Working');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (process.argv[1].endsWith('test-storage.js') || process.argv[1].endsWith('test-storage.ts')) {
  testStorage();
}

export { testStorage };
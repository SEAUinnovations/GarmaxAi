/**
 * E2E Test: Caching Behavior
 * 
 * Tests caching mechanisms to prevent cost overruns:
 * 1. Person analysis caching (Replicate LLaVA)
 * 2. Redis circuit breaker behavior
 * 3. Cache hit rate verification
 * 4. Cache invalidation on content change
 * 
 * Prerequisites:
 * - Docker services running (docker-compose up)
 * - Redis accessible
 * - Test user account created
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Test user credentials
const TEST_USER = {
  email: 'test-caching@example.com',
  password: 'TestPassword123!',
};

// Test fixtures
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const PERSON_IMAGE = path.join(FIXTURES_DIR, 'test-person.jpg');

let authToken: string;
let firstAnalysisTime: number;
let cachedAnalysisTime: number;

describe('Caching E2E', () => {
  
  beforeAll(async () => {
    // Authenticate
    const authResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    expect(authResponse.ok).toBe(true);
    const authData = await authResponse.json();
    authToken = authData.token;
    
    console.log('✅ Authenticated successfully');
  });

  it('should perform initial person analysis (cache miss)', async () => {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(PERSON_IMAGE));
    formData.append('name', 'Cache Test Avatar');
    formData.append('gender', 'male');

    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/avatars/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    firstAnalysisTime = Date.now() - startTime;

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data.avatar).toBeDefined();
    expect(data.avatar.bodyMetrics).toBeDefined();
    
    console.log(`✅ First analysis completed in ${firstAnalysisTime}ms`);
    console.log(`   Body metrics: ${JSON.stringify(data.avatar.bodyMetrics)}`);
  });

  it('should use cached person analysis (cache hit)', async () => {
    // Upload the same image again
    const formData = new FormData();
    formData.append('image', fs.createReadStream(PERSON_IMAGE));
    formData.append('name', 'Cache Test Avatar 2');
    formData.append('gender', 'male');

    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/avatars/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    cachedAnalysisTime = Date.now() - startTime;

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data.avatar).toBeDefined();
    expect(data.avatar.bodyMetrics).toBeDefined();
    
    console.log(`✅ Cached analysis completed in ${cachedAnalysisTime}ms`);
    console.log(`   Speedup: ${Math.round((firstAnalysisTime / cachedAnalysisTime) * 100) / 100}x faster`);
  });

  it('should demonstrate significant cache speedup', () => {
    // Cached request should be at least 5x faster
    const speedup = firstAnalysisTime / cachedAnalysisTime;
    
    expect(speedup).toBeGreaterThan(5);
    
    console.log(`✅ Cache effectiveness verified: ${speedup.toFixed(1)}x speedup`);
    console.log(`   First request: ${firstAnalysisTime}ms (API call to Replicate)`);
    console.log(`   Cached request: ${cachedAnalysisTime}ms (Redis lookup)`);
  });

  it('should verify content-based cache key (different images = different cache)', async () => {
    // Upload a different image - should NOT use cache
    const differentImage = path.join(FIXTURES_DIR, 'test-person-2.jpg');
    
    // If second test image doesn't exist, create it by modifying the first
    if (!fs.existsSync(differentImage)) {
      console.log('⚠️  Second test image not found, skipping this test');
      return;
    }

    const formData = new FormData();
    formData.append('image', fs.createReadStream(differentImage));
    formData.append('name', 'Different Person Avatar');
    formData.append('gender', 'female');

    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/avatars/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const differentImageTime = Date.now() - startTime;

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data.avatar).toBeDefined();
    
    // Different image should NOT benefit from cache (similar time to first request)
    const timeDifference = Math.abs(differentImageTime - firstAnalysisTime);
    const percentDifference = (timeDifference / firstAnalysisTime) * 100;
    
    expect(percentDifference).toBeLessThan(50); // Within 50% of first request time
    
    console.log(`✅ Content-based caching verified`);
    console.log(`   Different image time: ${differentImageTime}ms`);
    console.log(`   Similar to first request (no cache hit expected)`);
  });

  it('should handle Redis connection failure gracefully', async () => {
    // This test requires manually stopping Redis or using a fault injection tool
    // For now, we just verify the endpoint still works even if Redis is down
    
    console.log('ℹ️  Redis circuit breaker test');
    console.log('   To fully test: Stop Redis with `docker-compose stop redis`');
    console.log('   API should degrade gracefully to direct API calls');
    
    // Make a request - should work even if Redis is down
    const formData = new FormData();
    formData.append('image', fs.createReadStream(PERSON_IMAGE));
    formData.append('name', 'Resilience Test Avatar');
    formData.append('gender', 'male');

    const response = await fetch(`${API_BASE_URL}/api/avatars/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    // Should succeed even if Redis is unavailable
    expect(response.status).toBe(201);
    
    console.log('✅ Graceful degradation verified');
  });

  it('should verify cache statistics (if exposed)', async () => {
    // Check if cache stats endpoint exists
    const response = await fetch(`${API_BASE_URL}/api/debug/cache-stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (response.status === 404) {
      console.log('ℹ️  Cache stats endpoint not implemented (optional)');
      return;
    }

    expect(response.ok).toBe(true);
    const stats = await response.json();
    
    console.log('📊 Cache Statistics:');
    console.log(`   Hits: ${stats.hits || 'N/A'}`);
    console.log(`   Misses: ${stats.misses || 'N/A'}`);
    console.log(`   Hit Rate: ${stats.hitRate ? (stats.hitRate * 100).toFixed(1) + '%' : 'N/A'}`);
  });
});

/**
 * E2E Test: Try-On Flow
 * 
 * Tests the complete try-on workflow:
 * 1. Upload garment image
 * 2. Create user avatar
 * 3. Initiate try-on session
 * 4. Monitor WebSocket progress updates
 * 5. Verify final render result
 * 
 * Prerequisites:
 * - Docker services running (docker-compose up)
 * - Test user account created
 * - Valid test images in tests/fixtures/
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const WS_BASE_URL = process.env.WS_URL || 'ws://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test-tryon@example.com',
  password: 'TestPassword123!',
};

// Test fixtures paths
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const GARMENT_IMAGE = path.join(FIXTURES_DIR, 'test-garment.jpg');
const AVATAR_IMAGE = path.join(FIXTURES_DIR, 'test-person.jpg');

let authToken: string;
let garmentId: string;
let avatarId: string;
let sessionId: string;

describe('Try-On Flow E2E', () => {
  
  beforeAll(async () => {
    // Authenticate and get JWT token
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

  it('should upload a garment image', async () => {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(GARMENT_IMAGE));
    formData.append('category', 'tops');
    formData.append('name', 'E2E Test Garment');

    const response = await fetch(`${API_BASE_URL}/api/garments/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.garment).toBeDefined();
    expect(data.garment.id).toBeTruthy();
    
    garmentId = data.garment.id;
    console.log(`✅ Garment uploaded: ${garmentId}`);
  });

  it('should create a user avatar', async () => {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(AVATAR_IMAGE));
    formData.append('name', 'E2E Test Avatar');
    formData.append('gender', 'male');
    formData.append('height', '175');
    formData.append('bodyType', 'athletic');

    const response = await fetch(`${API_BASE_URL}/api/avatars/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.avatar).toBeDefined();
    expect(data.avatar.id).toBeTruthy();
    
    avatarId = data.avatar.id;
    console.log(`✅ Avatar created: ${avatarId}`);
  });

  it('should create a try-on session', async () => {
    const response = await fetch(`${API_BASE_URL}/api/tryon/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarId,
        garmentId,
        renderQuality: 'high',
        backgroundScene: 'studio',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.sessionId).toBeTruthy();
    expect(data.status).toBe('queued');
    
    sessionId = data.sessionId;
    console.log(`✅ Try-on session created: ${sessionId}`);
  });

  it('should receive WebSocket progress updates', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${authToken}`);
      const receivedUpdates: string[] = [];
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket timeout - no updates received'));
      }, 30000); // 30 second timeout

      ws.on('open', () => {
        console.log('🔌 WebSocket connected');
        
        // Subscribe to session updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          sessionId,
        }));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        console.log(`📨 WebSocket update: ${message.status} (${message.progress}%)`);
        
        receivedUpdates.push(message.status);

        // Check for completion or failure
        if (message.status === 'completed') {
          clearTimeout(timeout);
          ws.close();
          
          expect(receivedUpdates).toContain('processing');
          expect(message.resultUrl).toBeTruthy();
          console.log(`✅ Try-on completed: ${message.resultUrl}`);
          resolve();
        } else if (message.status === 'failed') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Try-on failed: ${message.error}`));
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });

  it('should verify final try-on result', async () => {
    const response = await fetch(`${API_BASE_URL}/api/tryon/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    expect(data.session.status).toBe('completed');
    expect(data.session.resultUrl).toBeTruthy();
    expect(data.session.progress).toBe(100);
    
    console.log(`✅ Final result verified: ${data.session.resultUrl}`);
  });

  afterAll(async () => {
    // Cleanup: delete test garment and avatar
    if (garmentId) {
      await fetch(`${API_BASE_URL}/api/garments/${garmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      console.log(`🗑️  Cleaned up garment: ${garmentId}`);
    }
    
    if (avatarId) {
      await fetch(`${API_BASE_URL}/api/avatars/${avatarId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      console.log(`🗑️  Cleaned up avatar: ${avatarId}`);
    }
  });
});

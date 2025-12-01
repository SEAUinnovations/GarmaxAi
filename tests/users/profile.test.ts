// User Profile API endpoint tests
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createTestClient, createTestProfile } from '../utils/testHelpers';

describe('User Profile API', () => {
  let client: ReturnType<typeof createTestClient>;
  let user: any;

  beforeEach(async () => {
    client = createTestClient();
    user = await client.createAuthenticatedUser();
  });

  describe('GET /api/users/profile/physical', () => {
    test('should return physical profile when it exists', async () => {
      await createTestProfile(user.id, {
        heightFeet: 6,
        heightInches: 0,
        measurementSystem: 'imperial',
        bodyType: 'athletic',
        fitPreference: 'fitted',
      });

      const response = await client
        .get('/api/users/profile/physical')
        .expect(200);

      expect(response.body).toMatchObject({
        heightFeet: 6,
        heightInches: 0,
        measurementSystem: 'imperial',
        bodyType: 'athletic',
        fitPreference: 'fitted',
      });
      expect(response.body.completionPercentage).toBeGreaterThan(0);
    });

    test('should return null when no profile exists', async () => {
      const response = await client
        .get('/api/users/profile/physical')
        .expect(200);

      expect(response.body).toBeNull();
    });

    test('should require authentication', async () => {
      const unauthenticatedClient = createTestClient();
      
      await unauthenticatedClient
        .get('/api/users/profile/physical')
        .expect(401);
    });
  });

  describe('PATCH /api/users/profile/physical', () => {
    test('should create new physical profile', async () => {
      const profileData = {
        heightFeet: 5,
        heightInches: 10,
        measurementSystem: 'imperial',
        bodyType: 'athletic',
        fitPreference: 'fitted',
      };

      const response = await client
        .patch('/api/users/profile/physical')
        .send(profileData)
        .expect(200);

      expect(response.body).toMatchObject(profileData);
      expect(response.body.userId).toBe(user.id);
      expect(response.body.completionPercentage).toBeGreaterThan(0);
    });

    test('should update existing physical profile', async () => {
      // Create initial profile
      await createTestProfile(user.id, {
        heightFeet: 5,
        heightInches: 8,
        measurementSystem: 'imperial',
      });

      // Update profile
      const updateData = {
        heightFeet: 6,
        heightInches: 2,
        bodyType: 'slim',
      };

      const response = await client
        .patch('/api/users/profile/physical')
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject(updateData);
      expect(response.body.measurementSystem).toBe('imperial'); // Should preserve existing fields
    });

    test('should validate height measurements', async () => {
      const response = await client
        .patch('/api/users/profile/physical')
        .send({
          heightFeet: 15, // Invalid height
          heightInches: 5,
        })
        .expect(400);

      expect(response.body.error).toContain('height');
    });

    test('should handle metric height measurements', async () => {
      const profileData = {
        heightCentimeters: 180,
        measurementSystem: 'metric',
      };

      const response = await client
        .patch('/api/users/profile/physical')
        .send(profileData)
        .expect(200);

      expect(response.body.heightCentimeters).toBe(180);
      expect(response.body.measurementSystem).toBe('metric');
    });

    test('should convert between measurement systems', async () => {
      // Create profile with imperial measurements
      await createTestProfile(user.id, {
        heightFeet: 6,
        heightInches: 0,
        measurementSystem: 'imperial',
      });

      // Update to metric
      const response = await client
        .patch('/api/users/profile/physical')
        .send({
          heightCentimeters: 185,
          measurementSystem: 'metric',
        })
        .expect(200);

      expect(response.body.heightCentimeters).toBe(185);
      expect(response.body.measurementSystem).toBe('metric');
      // Imperial values should be cleared/converted
      expect(response.body.heightFeet).toBeNull();
      expect(response.body.heightInches).toBeNull();
    });

    test('should validate measurement system', async () => {
      const response = await client
        .patch('/api/users/profile/physical')
        .send({
          measurementSystem: 'invalid',
        })
        .expect(400);

      expect(response.body.error).toContain('measurementSystem');
    });

    test('should require authentication', async () => {
      const unauthenticatedClient = createTestClient();
      
      await unauthenticatedClient
        .patch('/api/users/profile/physical')
        .send({
          heightFeet: 6,
          heightInches: 0,
        })
        .expect(401);
    });
  });

  describe('GET /api/users/profile/benefits', () => {
    test('should return profile completion benefits', async () => {
      await createTestProfile(user.id, {
        heightFeet: 6,
        heightInches: 0,
        measurementSystem: 'imperial',
        bodyType: 'athletic',
        fitPreference: 'fitted',
      });

      const response = await client
        .get('/api/users/profile/benefits')
        .expect(200);

      expect(response.body).toHaveProperty('completionPercentage');
      expect(response.body).toHaveProperty('benefits');
      expect(Array.isArray(response.body.benefits)).toBe(true);
      expect(response.body.completionPercentage).toBeGreaterThan(0);
    });

    test('should return low completion for empty profile', async () => {
      const response = await client
        .get('/api/users/profile/benefits')
        .expect(200);

      expect(response.body.completionPercentage).toBeLessThan(50);
      expect(response.body.benefits).toContain('Complete your profile');
    });

    test('should require authentication', async () => {
      const unauthenticatedClient = createTestClient();
      
      await unauthenticatedClient
        .get('/api/users/profile/benefits')
        .expect(401);
    });
  });

  describe('GET /api/users/profile', () => {
    test('should return user profile summary', async () => {
      const response = await client
        .get('/api/users/profile')
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        username: user.username,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        credits: user.credits,
      });
      expect(response.body).not.toHaveProperty('password');
    });

    test('should require authentication', async () => {
      const unauthenticatedClient = createTestClient();
      
      await unauthenticatedClient
        .get('/api/users/profile')
        .expect(401);
    });
  });
});
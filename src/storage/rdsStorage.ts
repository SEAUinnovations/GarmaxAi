import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and, desc, asc, sql, gte, lte } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import {
  users, 
  tempUsers, 
  generations,
  subscriptions,
  subscriptionPlans,
  tryonSessions,
  userAvatars,
  userPhotos,
  garmentItems,
  virtualWardrobe,
  organizations,
  organizationMembers,
  apiKeys,
  apiKeyUsage,
  externalCustomers,
  cartTryonSessions,
  webhookConfigurations,
  type User,
  type Generation,
  type InsertUser,
  type InsertGeneration,
  type TryonSession,
  type InsertTryonSession,
  type UserAvatar,
  type InsertUserAvatar,
  type UserPhoto,
  type InsertUserPhoto,
  type GarmentItem,
  type InsertGarmentItem,
  type VirtualWardrobe,
  type Organization,
  type InsertOrganization,
  type OrganizationMember,
  type InsertOrganizationMember,
  type ApiKey,
  type InsertApiKey,
  type ApiKeyUsage,
  type InsertApiKeyUsage,
  type ExternalCustomer,
  type InsertExternalCustomer,
  type CartTryonSession,
  type InsertCartTryonSession,
  type WebhookConfiguration,
  type InsertWebhookConfiguration
} from '@shared/schema';
import { type IStorage } from '../storage';
import { type TempUser } from '../types/index';
import { logger } from '../utils/winston-logger';

export class RDSStorage implements IStorage {
  private _db: ReturnType<typeof drizzle>;
  private connection!: mysql.Connection;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    // Initialize with placeholder - actual connection happens in connect()
    this._db = null as any;
  }

  // Getter to expose db instance for services that need direct access
  get db() {
    return this._db;
  }  async connect(): Promise<void> {
    try {
      // Create connection properly - await the Promise
      this.connection = await mysql.createConnection(this.connectionString);
      this._db = drizzle(this.connection);
      logger.info('Connected to RDS Aurora MySQL', 'RDSStorage');
    } catch (error) {
      logger.error(`Failed to connect to RDS: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.connection.end();
      logger.info('Disconnected from RDS Aurora MySQL', 'RDSStorage');
    } catch (error) {
      logger.error(`Failed to disconnect from RDS: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await this._db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      logger.error(`Error getting user ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this._db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      logger.error(`Error getting user by username ${username}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this._db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      logger.error(`Error getting user by email ${email}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async createUser(insertUser: InsertUser & {
    emailVerified?: boolean;
    trialExpiresAt?: Date;
    trialStatus?: 'active' | 'expired' | 'converted' | null;
    subscriptionTier?: 'free' | 'studio' | 'pro';
    creditsRemaining?: number;
  }): Promise<User> {
    try {
      const userId = crypto.randomUUID();
      await this._db.insert(users).values({
        id: userId,
        username: insertUser.username,
        email: insertUser.email,
        password: insertUser.password,
        emailVerified: insertUser.emailVerified || false,
        trialExpiresAt: insertUser.trialExpiresAt || null,
        trialStatus: insertUser.trialStatus || null,
        subscriptionTier: insertUser.subscriptionTier || 'free',
        credits: 10,
        creditsRemaining: insertUser.creditsRemaining || 10,
      });

      // Get the created user
      const createdUser = await this._db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!createdUser[0]) {
        throw new Error('Failed to retrieve created user');
      }

      logger.info(`Created user: ${createdUser[0].id} (${insertUser.username})`, 'RDSStorage');
      return createdUser[0] as User;
    } catch (error) {
      logger.error(`Error creating user: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateUserCredits(userId: string, credits: number): Promise<User> {
    try {
      await this._db.update(users)
        .set({ 
          credits, 
          creditsRemaining: credits,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      const updatedUser = await this.getUser(userId);
      if (!updatedUser) {
        throw new Error('User not found after update');
      }

      logger.info(`Updated credits for user ${userId}: ${credits}`, 'RDSStorage');
      return updatedUser;
    } catch (error) {
      logger.error(`Error updating user credits: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    try {
      const generationId = crypto.randomUUID();
      await this._db.insert(generations).values({
        ...generation,
        id: generationId
      });
      
      const createdGeneration = await this._db.select()
        .from(generations)
        .where(eq(generations.id, generationId))
        .limit(1);

      if (!createdGeneration[0]) {
        throw new Error('Failed to retrieve created generation');
      }

      logger.info(`Created generation: ${createdGeneration[0].id}`, 'RDSStorage');
      return createdGeneration[0] as Generation;
    } catch (error) {
      logger.error(`Error creating generation: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getGeneration(id: string): Promise<Generation | undefined> {
    try {
      const result = await this._db.select().from(generations).where(eq(generations.id, id)).limit(1);
      return result[0] as Generation | undefined;
    } catch (error) {
      logger.error(`Error getting generation ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserGenerations(userId: string): Promise<Generation[]> {
    try {
      const result = await this._db.select()
        .from(generations)
        .where(eq(generations.userId, userId))
        .orderBy(desc(generations.createdAt));

      return result as Generation[];
    } catch (error) {
      logger.error(`Error getting user generations for ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async cancelGeneration(id: string): Promise<boolean> {
    try {
      const result = await this._db.update(generations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(generations.id, id));

      return result[0].affectedRows > 0;
    } catch (error) {
      logger.error(`Error cancelling generation ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateGenerationStatus(id: string, status: "processing" | "completed" | "failed", errorMessage?: string): Promise<void> {
    try {
      const updateData: any = { 
        status, 
        updatedAt: new Date() 
      };
      
      // Note: errorMessage would need to be added to schema if we want to persist it
      // For now, we just update the status

      await this._db.update(generations)
        .set(updateData)
        .where(eq(generations.id, id));

      logger.info(`Updated generation ${id} status to ${status}`, 'RDSStorage');
    } catch (error) {
      logger.error(`Error updating generation status ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateGenerationResult(id: string, resultUrl: string): Promise<void> {
    try {
      await this._db.update(generations)
        .set({ 
          imageUrl: resultUrl,
          status: 'completed',
          updatedAt: new Date() 
        })
        .where(eq(generations.id, id));

      logger.info(`Updated generation ${id} with result URL`, 'RDSStorage');
    } catch (error) {
      logger.error(`Error updating generation result ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // OAuth methods
  async getUserByCognitoId(cognitoId: string): Promise<User | undefined> {
    try {
      // Note: cognitoId field needs to be added to schema
      // For now, using email as fallback until schema is updated
      const result = await this._db.select()
        .from(users)
        .where(sql`${users.username} LIKE ${cognitoId + '%'}`)
        .limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      logger.error(`Error getting user by Cognito ID ${cognitoId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async createUserFromOAuth(data: {
    cognitoId: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    profilePicture?: string;
  }): Promise<User> {
    try {
      const userId = crypto.randomUUID();
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 14); // 14-day trial

      const newUser = {
        id: userId,
        // Store cognitoId in username for now (until schema is updated)
        username: data.cognitoId.substring(0, 255),
        email: data.email,
        password: '', // No password for OAuth users
        emailVerified: data.emailVerified,
        trialExpiresAt,
        trialStatus: 'active' as const,
        subscriptionTier: 'free' as const,
        credits: 100,
        creditsRemaining: 100, // Initial credits
      };

      await this._db.insert(users).values(newUser);
      
      const createdUser = await this._db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!createdUser[0]) {
        throw new Error('Failed to retrieve created OAuth user');
      }

      logger.info(`Created OAuth user: ${data.email}`, 'RDSStorage');
      return createdUser[0] as User;
    } catch (error) {
      logger.error(`Error creating OAuth user: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Temporary user methods for email verification
  async createTempUser(data: {
    email: string;
    verificationCode: string;
    verificationExpiry: Date;
    trialExpiresAt: Date;
  }): Promise<TempUser> {
    try {
      const tempUserId = crypto.randomUUID();
      await this._db.insert(tempUsers).values({
        ...data,
        id: tempUserId
      });
      
      const createdTempUser = await this._db.select()
        .from(tempUsers)
        .where(eq(tempUsers.id, tempUserId))
        .limit(1);

      if (!createdTempUser[0]) {
        throw new Error('Failed to retrieve created temp user');
      }

      logger.info(`Created temp user: ${data.email}`, 'RDSStorage');
      return createdTempUser[0] as TempUser;
    } catch (error) {
      logger.error(`Error creating temp user: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getTempUserByEmail(email: string): Promise<TempUser | undefined> {
    try {
      const result = await this._db.select().from(tempUsers).where(eq(tempUsers.email, email)).limit(1);
      return result[0] as TempUser | undefined;
    } catch (error) {
      logger.error(`Error getting temp user by email ${email}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateTempUser(email: string, data: {
    verificationCode?: string;
    verificationExpiry?: Date;
  }): Promise<void> {
    try {
      await this._db.update(tempUsers)
        .set(data)
        .where(eq(tempUsers.email, email));

      logger.info(`Updated temp user: ${email}`, 'RDSStorage');
    } catch (error) {
      logger.error(`Error updating temp user ${email}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteTempUser(email: string): Promise<void> {
    try {
      await this._db.delete(tempUsers).where(eq(tempUsers.email, email));
      logger.info(`Deleted temp user: ${email}`, 'RDSStorage');
    } catch (error) {
      logger.error(`Error deleting temp user ${email}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Try-On Session Methods
  async createTryonSession(session: InsertTryonSession): Promise<TryonSession> {
    try {
      const sessionId = crypto.randomUUID();
      await this._db.insert(tryonSessions).values({
        ...session,
        id: sessionId,
        status: 'queued',
        progress: 0,
        creditsUsed: 0,
        usedQuota: false,
        refundedCredits: 0,
        customBackgroundPrompt: session.customBackgroundPrompt || null,
      });

      const createdSession = await this._db.select()
        .from(tryonSessions)
        .where(eq(tryonSessions.id, sessionId))
        .limit(1);

      if (!createdSession[0]) {
        throw new Error('Failed to retrieve created try-on session');
      }

      logger.info(`Created try-on session: ${sessionId}`, 'RDSStorage');
      return createdSession[0] as TryonSession;
    } catch (error) {
      logger.error(`Error creating try-on session: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getTryonSession(id: string): Promise<TryonSession | undefined> {
    try {
      const result = await this._db.select()
        .from(tryonSessions)
        .where(eq(tryonSessions.id, id))
        .limit(1);
      return result[0] as TryonSession | undefined;
    } catch (error) {
      logger.error(`Error getting try-on session ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateTryonSession(id: string, updates: Partial<TryonSession>): Promise<TryonSession | undefined> {
    try {
      await this._db.update(tryonSessions)
        .set(updates)
        .where(eq(tryonSessions.id, id));

      const updatedSession = await this.getTryonSession(id);
      if (updatedSession) {
        logger.info(`Updated try-on session: ${id}`, 'RDSStorage');
      }
      return updatedSession;
    } catch (error) {
      logger.error(`Error updating try-on session ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserTryonSessions(userId: string): Promise<TryonSession[]> {
    try {
      const result = await this._db.select()
        .from(tryonSessions)
        .where(eq(tryonSessions.userId, userId))
        .orderBy(desc(tryonSessions.createdAt));

      return result as TryonSession[];
    } catch (error) {
      logger.error(`Error getting try-on sessions for user ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // User Avatar Methods
  async createUserAvatar(avatar: InsertUserAvatar): Promise<UserAvatar> {
    try {
      const avatarId = crypto.randomUUID();
      await this._db.insert(userAvatars).values({
        ...avatar,
        id: avatarId,
        isDemo: avatar.isDemo || false,
        avatarThumbnailUrl: avatar.avatarThumbnailUrl || null,
      });

      const createdAvatar = await this._db.select()
        .from(userAvatars)
        .where(eq(userAvatars.id, avatarId))
        .limit(1);

      if (!createdAvatar[0]) {
        throw new Error('Failed to retrieve created avatar');
      }

      logger.info(`Created user avatar: ${avatarId}`, 'RDSStorage');
      return createdAvatar[0] as UserAvatar;
    } catch (error) {
      logger.error(`Error creating user avatar: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserAvatar(id: string): Promise<UserAvatar | undefined> {
    try {
      const result = await this._db.select()
        .from(userAvatars)
        .where(eq(userAvatars.id, id))
        .limit(1);
      return result[0] as UserAvatar | undefined;
    } catch (error) {
      logger.error(`Error getting user avatar ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserAvatars(userId: string): Promise<UserAvatar[]> {
    try {
      const result = await this._db.select()
        .from(userAvatars)
        .where(eq(userAvatars.userId, userId))
        .orderBy(desc(userAvatars.createdAt));

      return result as UserAvatar[];
    } catch (error) {
      logger.error(`Error getting avatars for user ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteUserAvatar(id: string): Promise<boolean> {
    try {
      const result = await this._db.delete(userAvatars)
        .where(eq(userAvatars.id, id));

      const deleted = result[0].affectedRows > 0;
      if (deleted) {
        logger.info(`Deleted user avatar: ${id}`, 'RDSStorage');
      }
      return deleted;
    } catch (error) {
      logger.error(`Error deleting user avatar ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Photo Methods
  async createUserPhoto(photo: InsertUserPhoto): Promise<UserPhoto> {
    try {
      const photoId = crypto.randomUUID();
      await this._db.insert(userPhotos).values({
        ...photo,
        id: photoId,
        smplProcessed: false,
        smplDataUrl: null,
        smplConfidence: null,
        smplMetadata: null,
        thumbnailUrl: photo.thumbnailUrl || null,
      });

      const createdPhoto = await this._db.select()
        .from(userPhotos)
        .where(eq(userPhotos.id, photoId))
        .limit(1);

      if (!createdPhoto[0]) {
        throw new Error('Failed to retrieve created photo');
      }

      logger.info(`Created user photo: ${photoId}`, 'RDSStorage');
      return createdPhoto[0] as UserPhoto;
    } catch (error) {
      logger.error(`Error creating user photo: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserPhoto(id: string): Promise<UserPhoto | undefined> {
    try {
      const result = await this._db.select()
        .from(userPhotos)
        .where(eq(userPhotos.id, id))
        .limit(1);
      return result[0] as UserPhoto | undefined;
    } catch (error) {
      logger.error(`Error getting user photo ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserPhotos(userId: string): Promise<UserPhoto[]> {
    try {
      const result = await this._db.select()
        .from(userPhotos)
        .where(eq(userPhotos.userId, userId))
        .orderBy(desc(userPhotos.createdAt));

      return result as UserPhoto[];
    } catch (error) {
      logger.error(`Error getting photos for user ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateUserPhoto(id: string, data: Partial<UserPhoto>): Promise<UserPhoto> {
    try {
      await this._db.update(userPhotos)
        .set(data)
        .where(eq(userPhotos.id, id));

      const updated = await this._db.select()
        .from(userPhotos)
        .where(eq(userPhotos.id, id))
        .limit(1);

      if (!updated[0]) {
        throw new Error(`Photo ${id} not found after update`);
      }

      logger.info(`Updated user photo: ${id}`, 'RDSStorage');
      return updated[0] as UserPhoto;
    } catch (error) {
      logger.error(`Error updating user photo ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteUserPhoto(id: string): Promise<boolean> {
    try {
      const result = await this._db.delete(userPhotos)
        .where(eq(userPhotos.id, id));

      const deleted = result[0].affectedRows > 0;
      if (deleted) {
        logger.info(`Deleted user photo: ${id}`, 'RDSStorage');
      }
      return deleted;
    } catch (error) {
      logger.error(`Error deleting user photo ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Garment Methods
  async createGarment(garment: InsertGarmentItem): Promise<GarmentItem> {
    try {
      const garmentId = crypto.randomUUID();
      await this._db.insert(garmentItems).values({
        ...garment,
        id: garmentId,
        color: garment.color || null,
        pattern: garment.pattern || null,
        brand: garment.brand || null,
        isOverlayable: garment.isOverlayable || false,
        overlayConfidence: garment.overlayConfidence || null,
        analysisData: garment.analysisData || null,
      });

      const createdGarment = await this._db.select()
        .from(garmentItems)
        .where(eq(garmentItems.id, garmentId))
        .limit(1);

      if (!createdGarment[0]) {
        throw new Error('Failed to retrieve created garment');
      }

      logger.info(`Created garment: ${garmentId}`, 'RDSStorage');
      return createdGarment[0] as GarmentItem;
    } catch (error) {
      logger.error(`Error creating garment: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getGarment(id: string): Promise<GarmentItem | undefined> {
    try {
      const result = await this._db.select()
        .from(garmentItems)
        .where(eq(garmentItems.id, id))
        .limit(1);
      return result[0] as GarmentItem | undefined;
    } catch (error) {
      logger.error(`Error getting garment ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateGarment(id: string, updates: Partial<GarmentItem>): Promise<GarmentItem | undefined> {
    try {
      await this._db.update(garmentItems)
        .set(updates)
        .where(eq(garmentItems.id, id));

      const updatedGarment = await this.getGarment(id);
      if (updatedGarment) {
        logger.info(`Updated garment: ${id}`, 'RDSStorage');
      }
      return updatedGarment;
    } catch (error) {
      logger.error(`Error updating garment ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteGarment(id: string): Promise<boolean> {
    try {
      // First delete from wardrobe
      await this._db.delete(virtualWardrobe)
        .where(eq(virtualWardrobe.garmentId, id));

      // Then delete the garment
      const result = await this._db.delete(garmentItems)
        .where(eq(garmentItems.id, id));

      const deleted = result[0].affectedRows > 0;
      if (deleted) {
        logger.info(`Deleted garment: ${id}`, 'RDSStorage');
      }
      return deleted;
    } catch (error) {
      logger.error(`Error deleting garment ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserWardrobe(userId: string): Promise<GarmentItem[]> {
    try {
      const result = await this._db.select({
        garment: garmentItems,
        wardrobeEntry: virtualWardrobe
      })
        .from(virtualWardrobe)
        .innerJoin(garmentItems, eq(virtualWardrobe.garmentId, garmentItems.id))
        .where(eq(virtualWardrobe.userId, userId))
        .orderBy(asc(virtualWardrobe.position));

      return result.map(r => r.garment) as GarmentItem[];
    } catch (error) {
      logger.error(`Error getting wardrobe for user ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async addToWardrobe(userId: string, garmentId: string): Promise<VirtualWardrobe> {
    try {
      const wardrobeId = crypto.randomUUID();
      
      // Get max position for user's wardrobe
      const userWardrobe = await this._db.select()
        .from(virtualWardrobe)
        .where(eq(virtualWardrobe.userId, userId));
      
      const maxPosition = userWardrobe.reduce((max, entry) => 
        Math.max(max, entry.position), -1
      );

      await this._db.insert(virtualWardrobe).values({
        id: wardrobeId,
        userId,
        garmentId,
        position: maxPosition + 1,
      });

      const createdEntry = await this._db.select()
        .from(virtualWardrobe)
        .where(eq(virtualWardrobe.id, wardrobeId))
        .limit(1);

      if (!createdEntry[0]) {
        throw new Error('Failed to retrieve wardrobe entry');
      }

      logger.info(`Added garment ${garmentId} to wardrobe for user ${userId}`, 'RDSStorage');
      return createdEntry[0] as VirtualWardrobe;
    } catch (error) {
      logger.error(`Error adding to wardrobe: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async removeFromWardrobe(userId: string, garmentId: string): Promise<boolean> {
    try {
      const result = await this._db.delete(virtualWardrobe)
        .where(and(
          eq(virtualWardrobe.userId, userId),
          eq(virtualWardrobe.garmentId, garmentId)
        ));

      const deleted = result[0].affectedRows > 0;
      if (deleted) {
        logger.info(`Removed garment ${garmentId} from wardrobe for user ${userId}`, 'RDSStorage');
      }
      return deleted;
    } catch (error) {
      logger.error(`Error removing from wardrobe: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Missing methods for compatibility
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    try {
      await this._db.update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, userId));

      const updatedUser = await this._db.select().from(users).where(eq(users.id, userId));
      if (updatedUser.length === 0) {
        throw new Error(`User ${userId} not found`);
      }
      return updatedUser[0] as User;
    } catch (error) {
      logger.error(`Error updating user: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getGarmentsByIds(garmentIds: string[]): Promise<GarmentItem[]> {
    try {
      const garments = await this._db.select()
        .from(garmentItems)
        .where(sql`${garmentItems.id} IN (${garmentIds.map(id => `'${id}'`).join(',')})`);
      return garments as GarmentItem[];
    } catch (error) {
      logger.error(`Error getting garments by IDs: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getActiveSubscription(userId: string): Promise<any | undefined> {
    try {
      const result = await this._db.select()
        .from(subscriptions)
        .where(and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        ))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      logger.error(`Error getting active subscription: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // ============================================================================
  // ENTERPRISE API METHODS
  // ============================================================================

  // Organization Methods
  async getOrganization(orgId: string): Promise<Organization | undefined> {
    try {
      const result = await this._db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      return result[0] as Organization | undefined;
    } catch (error) {
      logger.error(`Error getting organization ${orgId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    try {
      const result = await this._db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
      return result[0] as Organization | undefined;
    } catch (error) {
      logger.error(`Error getting organization by slug ${slug}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    try {
      const id = randomUUID();
      await this._db.insert(organizations).values({ ...data, id });
      const result = await this.getOrganization(id);
      if (!result) throw new Error('Failed to create organization');
      return result;
    } catch (error) {
      logger.error(`Error creating organization: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateOrganization(orgId: string, data: Partial<Organization>): Promise<Organization> {
    try {
      await this._db.update(organizations).set(data).where(eq(organizations.id, orgId));
      const result = await this.getOrganization(orgId);
      if (!result) throw new Error('Organization not found after update');
      return result;
    } catch (error) {
      logger.error(`Error updating organization ${orgId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      const result = await this._db.select({
        organization: organizations
      })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(eq(organizationMembers.userId, userId));
      
      return result.map(r => r.organization) as Organization[];
    } catch (error) {
      logger.error(`Error getting user organizations for ${userId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async addOrganizationCredits(orgId: string, amount: number): Promise<Organization> {
    try {
      await this._db.update(organizations)
        .set({ credits: sql`${organizations.credits} + ${amount}` })
        .where(eq(organizations.id, orgId));
      const result = await this.getOrganization(orgId);
      if (!result) throw new Error('Organization not found after adding credits');
      return result;
    } catch (error) {
      logger.error(`Error adding credits to organization ${orgId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deductOrganizationCredits(orgId: string, amount: number): Promise<Organization> {
    try {
      const result = await this._db.update(organizations)
        .set({ credits: sql`${organizations.credits} - ${amount}` })
        .where(and(
          eq(organizations.id, orgId),
          gte(organizations.credits, amount)
        ));
      
      if (!result || result[0]?.affectedRows === 0) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      
      const org = await this.getOrganization(orgId);
      if (!org) throw new Error('Organization not found after deducting credits');
      return org;
    } catch (error) {
      logger.error(`Error deducting credits from organization ${orgId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Organization Member Methods
  async getOrganizationMember(orgId: string, userId: string): Promise<OrganizationMember | undefined> {
    try {
      const result = await this._db.select().from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .limit(1);
      return result[0] as OrganizationMember | undefined;
    } catch (error) {
      logger.error(`Error getting organization member: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async addOrganizationMember(data: InsertOrganizationMember): Promise<OrganizationMember> {
    try {
      const id = randomUUID();
      await this._db.insert(organizationMembers).values({ ...data, id });
      const result = await this.getOrganizationMember(data.organizationId, data.userId);
      if (!result) throw new Error('Failed to add organization member');
      return result;
    } catch (error) {
      logger.error(`Error adding organization member: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async listOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    try {
      const result = await this._db.select().from(organizationMembers)
        .where(eq(organizationMembers.organizationId, orgId));
      return result as OrganizationMember[];
    } catch (error) {
      logger.error(`Error listing organization members: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // API Key Methods
  async createApiKey(data: InsertApiKey): Promise<ApiKey> {
    try {
      const id = randomUUID();
      await this._db.insert(apiKeys).values({ ...data, id });
      const result = await this.getApiKey(id);
      if (!result) throw new Error('Failed to create API key');
      return result;
    } catch (error) {
      logger.error(`Error creating API key: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getApiKey(keyId: string): Promise<ApiKey | undefined> {
    try {
      const result = await this._db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
      return result[0] as ApiKey | undefined;
    } catch (error) {
      logger.error(`Error getting API key ${keyId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined> {
    try {
      const result = await this._db.select().from(apiKeys)
        .where(and(
          eq(apiKeys.keyPrefix, prefix),
          eq(apiKeys.status, 'active')
        ))
        .limit(1);
      return result[0] as ApiKey | undefined;
    } catch (error) {
      logger.error(`Error getting API key by prefix: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async listOrganizationApiKeys(orgId: string): Promise<ApiKey[]> {
    try {
      const result = await this._db.select().from(apiKeys)
        .where(eq(apiKeys.organizationId, orgId))
        .orderBy(desc(apiKeys.createdAt));
      return result as ApiKey[];
    } catch (error) {
      logger.error(`Error listing organization API keys: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateApiKey(keyId: string, data: Partial<ApiKey>): Promise<ApiKey> {
    try {
      await this._db.update(apiKeys).set(data).where(eq(apiKeys.id, keyId));
      const result = await this.getApiKey(keyId);
      if (!result) throw new Error('API key not found after update');
      return result;
    } catch (error) {
      logger.error(`Error updating API key ${keyId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async revokeApiKey(keyId: string, userId: string, reason: string): Promise<ApiKey> {
    try {
      const now = new Date();
      await this._db.update(apiKeys)
        .set({
          status: 'revoked',
          revokedAt: now,
          revokedBy: userId,
          revokedReason: reason
        })
        .where(eq(apiKeys.id, keyId));
      const result = await this.getApiKey(keyId);
      if (!result) throw new Error('API key not found after revocation');
      return result;
    } catch (error) {
      logger.error(`Error revoking API key ${keyId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // External Customer Methods
  async createExternalCustomer(data: InsertExternalCustomer): Promise<ExternalCustomer> {
    try {
      const id = randomUUID();
      await this._db.insert(externalCustomers).values({ ...data, id });
      const result = await this.getExternalCustomer(data.organizationId, data.externalCustomerId);
      if (!result) throw new Error('Failed to create external customer');
      return result;
    } catch (error) {
      logger.error(`Error creating external customer: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getExternalCustomer(orgId: string, externalCustomerId: string): Promise<ExternalCustomer | undefined> {
    try {
      const result = await this._db.select().from(externalCustomers)
        .where(and(
          eq(externalCustomers.organizationId, orgId),
          eq(externalCustomers.externalCustomerId, externalCustomerId)
        ))
        .limit(1);
      return result[0] as ExternalCustomer | undefined;
    } catch (error) {
      logger.error(`Error getting external customer: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateExternalCustomer(id: string, data: Partial<ExternalCustomer>): Promise<ExternalCustomer> {
    try {
      await this._db.update(externalCustomers).set(data).where(eq(externalCustomers.id, id));
      const result = await this._db.select().from(externalCustomers).where(eq(externalCustomers.id, id)).limit(1);
      if (!result[0]) throw new Error('External customer not found after update');
      return result[0] as ExternalCustomer;
    } catch (error) {
      logger.error(`Error updating external customer ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async listExternalCustomers(orgId: string, limit: number = 50, offset: number = 0): Promise<ExternalCustomer[]> {
    try {
      const results = await this._db
        .select()
        .from(externalCustomers)
        .where(eq(externalCustomers.organizationId, orgId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(externalCustomers.createdAt));
      return results as ExternalCustomer[];
    } catch (error) {
      logger.error(`Error listing external customers for org ${orgId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteExternalCustomer(id: string): Promise<void> {
    try {
      await this._db.delete(externalCustomers).where(eq(externalCustomers.id, id));
    } catch (error) {
      logger.error(`Error deleting external customer ${id}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Cart Try-On Session Methods
  async createCartTryonSession(data: InsertCartTryonSession): Promise<CartTryonSession> {
    try {
      const id = randomUUID();
      await this._db.insert(cartTryonSessions).values({ ...data, id });
      const result = await this.getCartTryonSession(id);
      if (!result) throw new Error('Failed to create cart try-on session');
      return result;
    } catch (error) {
      logger.error(`Error creating cart try-on session: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getCartTryonSession(sessionId: string): Promise<CartTryonSession | undefined> {
    try {
      const result = await this._db.select().from(cartTryonSessions)
        .where(eq(cartTryonSessions.id, sessionId))
        .limit(1);
      return result[0] as CartTryonSession | undefined;
    } catch (error) {
      logger.error(`Error getting cart try-on session ${sessionId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async listCartTryonSessions(orgId: string, filters: any = {}, pagination: any = {}): Promise<CartTryonSession[]> {
    try {
      const { page = 1, limit = 50 } = pagination;
      const offset = (page - 1) * limit;
      
      let query = this._db.select().from(cartTryonSessions)
        .where(eq(cartTryonSessions.organizationId, orgId))
        .orderBy(desc(cartTryonSessions.createdAt))
        .limit(limit)
        .offset(offset);
      
      return await query as CartTryonSession[];
    } catch (error) {
      logger.error(`Error listing cart try-on sessions: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateCartTryonSession(sessionId: string, data: Partial<CartTryonSession>): Promise<CartTryonSession> {
    try {
      await this._db.update(cartTryonSessions).set(data).where(eq(cartTryonSessions.id, sessionId));
      const result = await this.getCartTryonSession(sessionId);
      if (!result) throw new Error('Cart try-on session not found after update');
      return result;
    } catch (error) {
      logger.error(`Error updating cart try-on session ${sessionId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // Webhook Configuration Methods
  async createWebhook(data: InsertWebhookConfiguration): Promise<WebhookConfiguration> {
    try {
      const id = randomUUID();
      await this._db.insert(webhookConfigurations).values({ ...data, id });
      const result = await this._db.select().from(webhookConfigurations)
        .where(eq(webhookConfigurations.id, id))
        .limit(1);
      if (!result[0]) throw new Error('Failed to create webhook');
      return result[0] as WebhookConfiguration;
    } catch (error) {
      logger.error(`Error creating webhook: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async listWebhooks(orgId: string): Promise<WebhookConfiguration[]> {
    try {
      const result = await this._db.select().from(webhookConfigurations)
        .where(eq(webhookConfigurations.organizationId, orgId))
        .orderBy(desc(webhookConfigurations.createdAt));
      return result as WebhookConfiguration[];
    } catch (error) {
      logger.error(`Error listing webhooks: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getWebhook(webhookId: string): Promise<WebhookConfiguration | undefined> {
    try {
      const result = await this._db.select().from(webhookConfigurations)
        .where(eq(webhookConfigurations.id, webhookId))
        .limit(1);
      return result[0] as WebhookConfiguration | undefined;
    } catch (error) {
      logger.error(`Error getting webhook ${webhookId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async updateWebhook(webhookId: string, data: Partial<WebhookConfiguration>): Promise<WebhookConfiguration> {
    try {
      await this._db.update(webhookConfigurations).set(data).where(eq(webhookConfigurations.id, webhookId));
      const result = await this._db.select().from(webhookConfigurations)
        .where(eq(webhookConfigurations.id, webhookId))
        .limit(1);
      if (!result[0]) throw new Error('Webhook not found after update');
      return result[0] as WebhookConfiguration;
    } catch (error) {
      logger.error(`Error updating webhook ${webhookId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      await this._db.delete(webhookConfigurations).where(eq(webhookConfigurations.id, webhookId));
      return true;
    } catch (error) {
      logger.error(`Error deleting webhook ${webhookId}: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  // API Key Usage Tracking Methods
  async logApiKeyUsage(data: InsertApiKeyUsage): Promise<void> {
    try {
      const id = randomUUID();
      await this._db.insert(apiKeyUsage).values({ ...data, id });
    } catch (error) {
      logger.error(`Error logging API key usage: ${error}`, 'RDSStorage');
      // Don't throw - usage logging should not block requests
    }
  }

  async getApiKeyUsageStats(keyId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const result = await this._db.select({
        totalRequests: sql<number>`COUNT(*)`,
        successfulRequests: sql<number>`SUM(CASE WHEN ${apiKeyUsage.statusCode} >= 200 AND ${apiKeyUsage.statusCode} < 300 THEN 1 ELSE 0 END)`,
        failedRequests: sql<number>`SUM(CASE WHEN ${apiKeyUsage.statusCode} >= 400 THEN 1 ELSE 0 END)`,
        totalCreditsUsed: sql<number>`SUM(${apiKeyUsage.creditsUsed})`,
        avgResponseTime: sql<number>`AVG(${apiKeyUsage.processingTimeMs})`
      })
        .from(apiKeyUsage)
        .where(and(
          eq(apiKeyUsage.apiKeyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        ));
      
      return result[0];
    } catch (error) {
      logger.error(`Error getting API key usage stats: ${error}`, 'RDSStorage');
      throw error;
    }
  }

  async getOrganizationUsageStats(orgId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const result = await this._db.select({
        totalRequests: sql<number>`COUNT(*)`,
        successfulRequests: sql<number>`SUM(CASE WHEN ${apiKeyUsage.statusCode} >= 200 AND ${apiKeyUsage.statusCode} < 300 THEN 1 ELSE 0 END)`,
        failedRequests: sql<number>`SUM(CASE WHEN ${apiKeyUsage.statusCode} >= 400 THEN 1 ELSE 0 END)`,
        totalCreditsUsed: sql<number>`SUM(${apiKeyUsage.creditsUsed})`,
        avgResponseTime: sql<number>`AVG(${apiKeyUsage.processingTimeMs})`
      })
        .from(apiKeyUsage)
        .where(and(
          eq(apiKeyUsage.organizationId, orgId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        ));
      
      return result[0];
    } catch (error) {
      logger.error(`Error getting organization usage stats: ${error}`, 'RDSStorage');
      throw error;
    }
  }
}
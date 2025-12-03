import { 
  type User, 
  type InsertUser, 
  type Generation, 
  type InsertGeneration,
  type TryonSession,
  type InsertTryonSession,
  type UserAvatar,
  type InsertUserAvatar,
  type GarmentItem,
  type InsertGarmentItem,
  type VirtualWardrobe
} from "@shared/schema";
import { type TempUser } from "../types/index";
import { type IStorage } from '../storage';
import { randomUUID } from "crypto";

/**
 * In-memory storage implementation for development/testing
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private generations: Map<string, Generation>;
  private tempUsers: Map<string, TempUser>;
  private tryonSessions: Map<string, TryonSession>;
  private userAvatars: Map<string, UserAvatar>;
  private garmentItems: Map<string, GarmentItem>;
  private virtualWardrobe: Map<string, VirtualWardrobe>;

  constructor() {
    this.users = new Map();
    this.generations = new Map();
    this.tempUsers = new Map();
    this.tryonSessions = new Map();
    this.userAvatars = new Map();
    this.garmentItems = new Map();
    this.virtualWardrobe = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser & {
    emailVerified?: boolean;
    trialExpiresAt?: Date;
    trialStatus?: 'active' | 'expired' | 'converted' | null;
    subscriptionTier?: 'free' | 'studio' | 'pro';
    creditsRemaining?: number;
  }): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      emailVerified: insertUser.emailVerified || false,
      trialExpiresAt: insertUser.trialExpiresAt || null,
      trialStatus: insertUser.trialStatus || null,
      subscriptionTier: insertUser.subscriptionTier || 'free',
      credits: 10,
      creditsRemaining: insertUser.creditsRemaining || 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    this.users.set(id, user);
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updated: User = {
      ...user,
      credits,
      creditsRemaining: credits,
      updatedAt: new Date(),
    };

    this.users.set(userId, updated);
    return updated;
  }

  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    const id = randomUUID();
    const newGeneration: Generation = {
      ...generation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Generation;

    this.generations.set(id, newGeneration);
    return newGeneration;
  }

  async getGeneration(id: string): Promise<Generation | undefined> {
    return this.generations.get(id);
  }

  async getUserGenerations(userId: string): Promise<Generation[]> {
    return Array.from(this.generations.values()).filter(
      (gen) => gen.userId === userId,
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async cancelGeneration(id: string): Promise<boolean> {
    const generation = this.generations.get(id);
    if (!generation) {
      return false;
    }

    const updated: Generation = {
      ...generation,
      status: 'cancelled',
      updatedAt: new Date(),
    };

    this.generations.set(id, updated);
    return true;
  }

  async createTempUser(data: {
    email: string;
    verificationCode: string;
    verificationExpiry: Date;
    trialExpiresAt: Date;
  }): Promise<TempUser> {
    const id = randomUUID();
    const tempUser: TempUser = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.tempUsers.set(data.email, tempUser);
    return tempUser;
  }

  async getTempUserByEmail(email: string): Promise<TempUser | undefined> {
    return this.tempUsers.get(email);
  }

  async updateTempUser(email: string, data: {
    verificationCode?: string;
    verificationExpiry?: Date;
  }): Promise<void> {
    const tempUser = this.tempUsers.get(email);
    if (tempUser) {
      const updated = {
        ...tempUser,
        ...data,
      };
      this.tempUsers.set(email, updated);
    }
  }

  async deleteTempUser(email: string): Promise<void> {
    this.tempUsers.delete(email);
  }

  // Try-On Session Methods
  async createTryonSession(session: InsertTryonSession): Promise<TryonSession> {
    const id = randomUUID();
    const newSession: TryonSession = {
      ...session,
      id,
      status: 'queued',
      progress: 0,
      creditsUsed: 0,
      usedQuota: false,
      refundedCredits: 0,
      previewExpiresAt: null,
      baseImageUrl: null,
      renderedImageUrl: null,
      completedAt: null,
      customBackgroundPrompt: session.customBackgroundPrompt || null,
      createdAt: new Date(),
    };
    this.tryonSessions.set(id, newSession);
    return newSession;
  }

  async getTryonSession(id: string): Promise<TryonSession | undefined> {
    return this.tryonSessions.get(id);
  }

  async updateTryonSession(id: string, updates: Partial<TryonSession>): Promise<TryonSession | undefined> {
    const session = this.tryonSessions.get(id);
    if (!session) {
      return undefined;
    }

    const updated: TryonSession = {
      ...session,
      ...updates,
    };

    this.tryonSessions.set(id, updated);
    return updated;
  }

  async getUserTryonSessions(userId: string): Promise<TryonSession[]> {
    return Array.from(this.tryonSessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // User Avatar Methods
  async createUserAvatar(avatar: InsertUserAvatar): Promise<UserAvatar> {
    const id = randomUUID();
    const newAvatar: UserAvatar = {
      ...avatar,
      id,
      isDemo: avatar.isDemo || false,
      avatarThumbnailUrl: avatar.avatarThumbnailUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userAvatars.set(id, newAvatar);
    return newAvatar;
  }

  async getUserAvatar(id: string): Promise<UserAvatar | undefined> {
    return this.userAvatars.get(id);
  }

  async getUserAvatars(userId: string): Promise<UserAvatar[]> {
    return Array.from(this.userAvatars.values())
      .filter(avatar => avatar.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteUserAvatar(id: string): Promise<boolean> {
    return this.userAvatars.delete(id);
  }

  // Garment Methods
  async createGarment(garment: InsertGarmentItem): Promise<GarmentItem> {
    const id = randomUUID();
    const newGarment: GarmentItem = {
      ...garment,
      id,
      color: garment.color || null,
      pattern: garment.pattern || null,
      brand: garment.brand || null,
      isOverlayable: garment.isOverlayable || false,
      overlayConfidence: garment.overlayConfidence || null,
      analysisData: garment.analysisData || null,
      createdAt: new Date(),
    };
    this.garmentItems.set(id, newGarment);
    return newGarment;
  }

  async getGarment(id: string): Promise<GarmentItem | undefined> {
    return this.garmentItems.get(id);
  }

  async updateGarment(id: string, updates: Partial<GarmentItem>): Promise<GarmentItem | undefined> {
    const garment = this.garmentItems.get(id);
    if (!garment) {
      return undefined;
    }

    const updated: GarmentItem = {
      ...garment,
      ...updates,
    };

    this.garmentItems.set(id, updated);
    return updated;
  }

  async deleteGarment(id: string): Promise<boolean> {
    // Also remove from wardrobe
    const wardrobeEntries = Array.from(this.virtualWardrobe.values())
      .filter(entry => entry.garmentId === id);
    
    for (const entry of wardrobeEntries) {
      this.virtualWardrobe.delete(entry.id);
    }

    return this.garmentItems.delete(id);
  }

  async getUserWardrobe(userId: string): Promise<GarmentItem[]> {
    const wardrobeEntries = Array.from(this.virtualWardrobe.values())
      .filter(entry => entry.userId === userId)
      .sort((a, b) => a.position - b.position);

    const garments: GarmentItem[] = [];
    for (const entry of wardrobeEntries) {
      const garment = this.garmentItems.get(entry.garmentId);
      if (garment) {
        garments.push(garment);
      }
    }

    return garments;
  }

  async addToWardrobe(userId: string, garmentId: string): Promise<VirtualWardrobe> {
    const id = randomUUID();
    
    // Get max position for user's wardrobe
    const userWardrobe = Array.from(this.virtualWardrobe.values())
      .filter(entry => entry.userId === userId);
    const maxPosition = userWardrobe.reduce((max, entry) => Math.max(max, entry.position), -1);

    const wardrobeEntry: VirtualWardrobe = {
      id,
      userId,
      garmentId,
      position: maxPosition + 1,
      addedAt: new Date(),
    };

    this.virtualWardrobe.set(id, wardrobeEntry);
    return wardrobeEntry;
  }

  async removeFromWardrobe(userId: string, garmentId: string): Promise<boolean> {
    const entry = Array.from(this.virtualWardrobe.values())
      .find(e => e.userId === userId && e.garmentId === garmentId);
    
    if (!entry) {
      return false;
    }

    return this.virtualWardrobe.delete(entry.id);
  }

  // Missing methods for compatibility
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    const updatedUser = { ...user, ...data, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getGarmentsByIds(garmentIds: string[]): Promise<GarmentItem[]> {
    return garmentIds.map(id => this.garmentItems.get(id)).filter(Boolean) as GarmentItem[];
  }

  async getActiveSubscription(userId: string): Promise<any | undefined> {
    // Mock implementation - return null for now
    return null;
  }
}
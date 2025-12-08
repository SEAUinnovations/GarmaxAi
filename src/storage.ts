import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { type TempUser } from "./types/index";
import { StorageFactory } from "./storage/storageFactory";

// Storage interface for database operations
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & {
    emailVerified?: boolean;
    trialExpiresAt?: Date;
    trialStatus?: 'active' | 'expired' | 'converted' | null;
    subscriptionTier?: 'free' | 'studio' | 'pro';
    creditsRemaining?: number;
  }): Promise<User>;
  updateUser(userId: string, data: Partial<User>): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User>;
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  cancelGeneration(id: string): Promise<boolean>;
  
  // OAuth methods
  getUserByCognitoId(cognitoId: string): Promise<User | undefined>;
  createUserFromOAuth(data: {
    cognitoId: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    profilePicture?: string;
  }): Promise<User>;
  
  // Avatar methods
  getUserAvatars(userId: string): Promise<any[]>;
  getUserAvatar(avatarId: string): Promise<any | undefined>;
  createUserAvatar(data: any): Promise<any>;
  deleteUserAvatar(avatarId: string): Promise<boolean>;
  
  // Garment methods
  createGarment(data: any): Promise<any>;
  getGarment(garmentId: string): Promise<any | undefined>;
  getGarmentsByIds(garmentIds: string[]): Promise<any[]>;
  updateGarment(garmentId: string, data: any): Promise<any>;
  deleteGarment(garmentId: string): Promise<boolean>;
  getUserWardrobe(userId: string): Promise<any[]>;
  addToWardrobe(userId: string, garmentId: string): Promise<any>;
  
  // Try-on session methods
  createTryonSession(data: any): Promise<any>;
  getTryonSession(sessionId: string): Promise<any | undefined>;
  getUserTryonSessions(userId: string, limit?: number): Promise<any[]>;
  updateTryonSession(sessionId: string, data: any): Promise<any>;
  
  // Subscription methods
  getActiveSubscription(userId: string): Promise<any | undefined>;
  
  // Temp user methods for email verification
  createTempUser(data: {
    email: string;
    verificationCode: string;
    verificationExpiry: Date;
    trialExpiresAt: Date;
  }): Promise<TempUser>;
  getTempUserByEmail(email: string): Promise<TempUser | undefined>;
  updateTempUser(email: string, data: {
    verificationCode?: string;
    verificationExpiry?: Date;
  }): Promise<void>;
  deleteTempUser(email: string): Promise<void>;
}

// Export factory and helper functions
export { StorageFactory };

// Helper function to get storage instance
export const getStorage = () => StorageFactory.getStorage();

// Legacy support - maintain storage export for existing code
export const storage = {
  getUser: async (id: string) => (await StorageFactory.getStorage()).getUser(id),
  getUserById: async (id: string) => (await StorageFactory.getStorage()).getUserById(id),
  getUserByUsername: async (username: string) => (await StorageFactory.getStorage()).getUserByUsername(username),
  getUserByEmail: async (email: string) => (await StorageFactory.getStorage()).getUserByEmail(email),
  createUser: async (user: InsertUser & {
    emailVerified?: boolean;
    trialExpiresAt?: Date;
    trialStatus?: 'active' | 'expired' | 'converted' | null;
    subscriptionTier?: 'free' | 'studio' | 'pro';
    creditsRemaining?: number;
  }) => (await StorageFactory.getStorage()).createUser(user),
  getUserByCognitoId: async (cognitoId: string) => (await StorageFactory.getStorage()).getUserByCognitoId(cognitoId),
  createUserFromOAuth: async (data: {
    cognitoId: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    profilePicture?: string;
  }) => (await StorageFactory.getStorage()).createUserFromOAuth(data),
  updateUserCredits: async (userId: string, credits: number) => (await StorageFactory.getStorage()).updateUserCredits(userId, credits),
  createGeneration: async (generation: InsertGeneration) => (await StorageFactory.getStorage()).createGeneration(generation),
  getGeneration: async (id: string) => (await StorageFactory.getStorage()).getGeneration(id),
  getUserGenerations: async (userId: string) => (await StorageFactory.getStorage()).getUserGenerations(userId),
  cancelGeneration: async (id: string) => (await StorageFactory.getStorage()).cancelGeneration(id),
  createTempUser: async (data: {
    email: string;
    verificationCode: string;
    verificationExpiry: Date;
    trialExpiresAt: Date;
  }) => (await StorageFactory.getStorage()).createTempUser(data),
  getTempUserByEmail: async (email: string) => (await StorageFactory.getStorage()).getTempUserByEmail(email),
  updateTempUser: async (email: string, data: {
    verificationCode?: string;
    verificationExpiry?: Date;
  }) => (await StorageFactory.getStorage()).updateTempUser(email, data),
  deleteTempUser: async (email: string) => (await StorageFactory.getStorage()).deleteTempUser(email),
  
  // Avatar methods
  getUserAvatars: async (userId: string) => (await StorageFactory.getStorage()).getUserAvatars(userId),
  getUserAvatar: async (avatarId: string) => (await StorageFactory.getStorage()).getUserAvatar(avatarId),
  createUserAvatar: async (data: any) => (await StorageFactory.getStorage()).createUserAvatar(data),
  deleteUserAvatar: async (avatarId: string) => (await StorageFactory.getStorage()).deleteUserAvatar(avatarId),
  
  // Garment methods
  createGarment: async (data: any) => (await StorageFactory.getStorage()).createGarment(data),
  getGarment: async (garmentId: string) => (await StorageFactory.getStorage()).getGarment(garmentId),
  getGarmentsByIds: async (garmentIds: string[]) => (await StorageFactory.getStorage()).getGarmentsByIds(garmentIds),
  updateGarment: async (garmentId: string, data: any) => (await StorageFactory.getStorage()).updateGarment(garmentId, data),
  deleteGarment: async (garmentId: string) => (await StorageFactory.getStorage()).deleteGarment(garmentId),
  getUserWardrobe: async (userId: string) => (await StorageFactory.getStorage()).getUserWardrobe(userId),
  addToWardrobe: async (userId: string, garmentId: string) => (await StorageFactory.getStorage()).addToWardrobe(userId, garmentId),
  
  // Try-on session methods
  createTryonSession: async (data: any) => (await StorageFactory.getStorage()).createTryonSession(data),
  getTryonSession: async (sessionId: string) => (await StorageFactory.getStorage()).getTryonSession(sessionId),
  getUserTryonSessions: async (userId: string, limit?: number) => (await StorageFactory.getStorage()).getUserTryonSessions(userId, limit),
  updateTryonSession: async (sessionId: string, data: any) => (await StorageFactory.getStorage()).updateTryonSession(sessionId, data),
  
  // Subscription methods
  getActiveSubscription: async (userId: string) => (await StorageFactory.getStorage()).getActiveSubscription(userId),
  
  // User methods
  updateUser: async (userId: string, data: Partial<any>) => (await StorageFactory.getStorage()).updateUser(userId, data),
};

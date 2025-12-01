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
  updateUserCredits(userId: string, credits: number): Promise<User>;
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  cancelGeneration(id: string): Promise<boolean>;
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
};

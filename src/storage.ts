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
  updateGenerationStatus(id: string, status: "processing" | "completed" | "failed", errorMessage?: string): Promise<void>;
  updateGenerationResult(id: string, resultUrl: string): Promise<void>;
  
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
  
  // Photo methods
  getUserPhotos(userId: string): Promise<any[]>;
  getUserPhoto(photoId: string): Promise<any | undefined>;
  createUserPhoto(data: any): Promise<any>;
  updateUserPhoto(photoId: string, data: any): Promise<any>;
  deleteUserPhoto(photoId: string): Promise<boolean>;
  
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
  
  // Enterprise API - Organization methods
  getOrganization(orgId: string): Promise<any | undefined>;
  getOrganizationBySlug(slug: string): Promise<any | undefined>;
  createOrganization(data: any): Promise<any>;
  updateOrganization(orgId: string, data: any): Promise<any>;
  getUserOrganizations(userId: string): Promise<any[]>;
  addOrganizationCredits(orgId: string, amount: number): Promise<any>;
  deductOrganizationCredits(orgId: string, amount: number): Promise<any>;
  
  // Enterprise API - Organization member methods
  getOrganizationMember(orgId: string, userId: string): Promise<any | undefined>;
  addOrganizationMember(data: any): Promise<any>;
  listOrganizationMembers(orgId: string): Promise<any[]>;
  
  // Enterprise API - API key methods
  createApiKey(data: any): Promise<any>;
  getApiKey(keyId: string): Promise<any | undefined>;
  getApiKeyByPrefix(prefix: string): Promise<any | undefined>;
  listOrganizationApiKeys(orgId: string): Promise<any[]>;
  updateApiKey(keyId: string, data: any): Promise<any>;
  revokeApiKey(keyId: string, userId: string, reason: string): Promise<any>;
  
  // Enterprise API - External customer methods
  createExternalCustomer(data: any): Promise<any>;
  getExternalCustomer(orgId: string, externalCustomerId: string): Promise<any | undefined>;
  updateExternalCustomer(id: string, data: any): Promise<any>;
  listExternalCustomers(orgId: string, limit: number, offset: number): Promise<any[]>;
  deleteExternalCustomer(id: string): Promise<void>;
  
  // Enterprise API - Cart try-on session methods
  createCartTryonSession(data: any): Promise<any>;
  getCartTryonSession(sessionId: string): Promise<any | undefined>;
  listCartTryonSessions(orgId: string, filters?: any, pagination?: any): Promise<any[]>;
  updateCartTryonSession(sessionId: string, data: any): Promise<any>;
  
  // Enterprise API - Webhook methods
  createWebhook(data: any): Promise<any>;
  getWebhook(webhookId: string): Promise<any | undefined>;
  listWebhooks(orgId: string): Promise<any[]>;
  updateWebhook(webhookId: string, data: any): Promise<any>;
  deleteWebhook(webhookId: string): Promise<boolean>;
  
  // Enterprise API - Usage tracking methods
  logApiKeyUsage(data: any): Promise<void>;
  getApiKeyUsageStats(keyId: string, startDate: Date, endDate: Date): Promise<any>;
  getOrganizationUsageStats(orgId: string, startDate: Date, endDate: Date): Promise<any>;
  
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
  
  // Photo methods
  getUserPhotos: async (userId: string) => (await StorageFactory.getStorage()).getUserPhotos(userId),
  getUserPhoto: async (photoId: string) => (await StorageFactory.getStorage()).getUserPhoto(photoId),
  createUserPhoto: async (data: any) => (await StorageFactory.getStorage()).createUserPhoto(data),
  updateUserPhoto: async (photoId: string, data: any) => (await StorageFactory.getStorage()).updateUserPhoto(photoId, data),
  deleteUserPhoto: async (photoId: string) => (await StorageFactory.getStorage()).deleteUserPhoto(photoId),
  
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
  
  // Enterprise API - Organization methods
  getOrganization: async (orgId: string) => (await StorageFactory.getStorage()).getOrganization(orgId),
  getOrganizationBySlug: async (slug: string) => (await StorageFactory.getStorage()).getOrganizationBySlug(slug),
  createOrganization: async (data: any) => (await StorageFactory.getStorage()).createOrganization(data),
  updateOrganization: async (orgId: string, data: any) => (await StorageFactory.getStorage()).updateOrganization(orgId, data),
  getUserOrganizations: async (userId: string) => (await StorageFactory.getStorage()).getUserOrganizations(userId),
  addOrganizationCredits: async (orgId: string, amount: number) => (await StorageFactory.getStorage()).addOrganizationCredits(orgId, amount),
  deductOrganizationCredits: async (orgId: string, amount: number) => (await StorageFactory.getStorage()).deductOrganizationCredits(orgId, amount),
  
  // Enterprise API - Organization member methods
  getOrganizationMember: async (orgId: string, userId: string) => (await StorageFactory.getStorage()).getOrganizationMember(orgId, userId),
  addOrganizationMember: async (data: any) => (await StorageFactory.getStorage()).addOrganizationMember(data),
  listOrganizationMembers: async (orgId: string) => (await StorageFactory.getStorage()).listOrganizationMembers(orgId),
  
  // Enterprise API - API key methods
  createApiKey: async (data: any) => (await StorageFactory.getStorage()).createApiKey(data),
  getApiKey: async (keyId: string) => (await StorageFactory.getStorage()).getApiKey(keyId),
  getApiKeyByPrefix: async (prefix: string) => (await StorageFactory.getStorage()).getApiKeyByPrefix(prefix),
  listOrganizationApiKeys: async (orgId: string) => (await StorageFactory.getStorage()).listOrganizationApiKeys(orgId),
  updateApiKey: async (keyId: string, data: any) => (await StorageFactory.getStorage()).updateApiKey(keyId, data),
  revokeApiKey: async (keyId: string, userId: string, reason: string) => (await StorageFactory.getStorage()).revokeApiKey(keyId, userId, reason),
  
  // Enterprise API - External customer methods
  createExternalCustomer: async (data: any) => (await StorageFactory.getStorage()).createExternalCustomer(data),
  getExternalCustomer: async (orgId: string, externalCustomerId: string) => (await StorageFactory.getStorage()).getExternalCustomer(orgId, externalCustomerId),
  updateExternalCustomer: async (id: string, data: any) => (await StorageFactory.getStorage()).updateExternalCustomer(id, data),
  listExternalCustomers: async (orgId: string, limit: number, offset: number) => (await StorageFactory.getStorage()).listExternalCustomers(orgId, limit, offset),
  deleteExternalCustomer: async (id: string) => (await StorageFactory.getStorage()).deleteExternalCustomer(id),
  
  // Enterprise API - Cart try-on session methods
  createCartTryonSession: async (data: any) => (await StorageFactory.getStorage()).createCartTryonSession(data),
  getCartTryonSession: async (sessionId: string) => (await StorageFactory.getStorage()).getCartTryonSession(sessionId),
  listCartTryonSessions: async (orgId: string, filters?: any, pagination?: any) => (await StorageFactory.getStorage()).listCartTryonSessions(orgId, filters, pagination),
  updateCartTryonSession: async (sessionId: string, data: any) => (await StorageFactory.getStorage()).updateCartTryonSession(sessionId, data),
  
  // Enterprise API - Webhook methods
  createWebhook: async (data: any) => (await StorageFactory.getStorage()).createWebhook(data),
  getWebhook: async (webhookId: string) => (await StorageFactory.getStorage()).getWebhook(webhookId),
  listWebhooks: async (orgId: string) => (await StorageFactory.getStorage()).listWebhooks(orgId),
  updateWebhook: async (webhookId: string, data: any) => (await StorageFactory.getStorage()).updateWebhook(webhookId, data),
  deleteWebhook: async (webhookId: string) => (await StorageFactory.getStorage()).deleteWebhook(webhookId),
  
  // Enterprise API - Usage tracking methods
  logApiKeyUsage: async (data: any) => (await StorageFactory.getStorage()).logApiKeyUsage(data),
  getApiKeyUsageStats: async (keyId: string, startDate: Date, endDate: Date) => (await StorageFactory.getStorage()).getApiKeyUsageStats(keyId, startDate, endDate),
  getOrganizationUsageStats: async (orgId: string, startDate: Date, endDate: Date) => (await StorageFactory.getStorage()).getOrganizationUsageStats(orgId, startDate, endDate),
};

import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, timestamp, json, boolean, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export types
export type RenderQuality = "sd" | "hd" | "4k";

// Users table
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  trialExpiresAt: timestamp("trial_expires_at"),
  trialStatus: varchar("trial_status", { length: 20 }).default("active"), // 'active', 'expired', 'converted', null
  subscriptionTier: varchar("subscription_tier", { length: 20 }).notNull().default("free"), // 'free', 'studio', 'pro'
  credits: int("credits").notNull().default(10),
  creditsRemaining: int("credits_remaining").notNull().default(10),
  
  // Physical profile fields
  heightFeet: int("height_feet"), // 4-7 feet
  heightInches: int("height_inches"), // 0-11 inches
  ageRange: varchar("age_range", { length: 20 }), // '18-25', '26-35', '36-45', '46-55', '55+'
  gender: varchar("gender", { length: 20 }), // 'male', 'female', 'non-binary', 'prefer-not-to-say'
  bodyType: varchar("body_type", { length: 20 }), // 'slim', 'average', 'athletic', 'plus-size'
  ethnicity: text("ethnicity"), // Free text for inclusive representation
  
  // Profile completion tracking
  profileCompleted: boolean("profile_completed").notNull().default(false),
  profileCompletedAt: timestamp("profile_completed_at"),
  
  // Preferences
  stylePreferences: json("style_preferences"), // Array of preferred styles
  measurementSystem: varchar("measurement_system", { length: 10 }).notNull().default("imperial"), // 'imperial' or 'metric'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Temporary users table for email verification
export const tempUsers = mysqlTable("temp_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  verificationCode: varchar("verification_code", { length: 10 }).notNull(),
  verificationExpiry: timestamp("verification_expiry").notNull(),
  trialExpiresAt: timestamp("trial_expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Generations table - stores AI image generation requests
export const generations = mysqlTable("generations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  style: varchar("style", { length: 50 }).notNull(),
  quality: varchar("quality", { length: 20 }).notNull().default("medium"),
  imageUrl: text("image_url"),
  creditsUsed: int("credits_used").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Subscription Plans table
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 50 }).notNull(),
  price: int("price").notNull(), // in cents
  tryonQuota: int("tryon_quota").notNull(),
  avatarLimit: int("avatar_limit").notNull(),
  maxResolution: varchar("max_resolution", { length: 10 }).notNull(),
  features: json("features"),
  stripePriceId: text("stripe_price_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subscriptions table
export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  status: varchar("status", { length: 20 }).notNull(), // active, cancelled, past_due
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  tryonQuotaUsed: int("tryon_quota_used").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// User Avatars table
export const userAvatars = mysqlTable("user_avatars", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  rpmAvatarId: text("rpm_avatar_id").notNull(),
  avatarGlbUrl: text("avatar_glb_url").notNull(),
  avatarThumbnailUrl: text("avatar_thumbnail_url"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Garment Items table
export const garmentItems = mysqlTable("garment_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  imageUrl: text("image_url").notNull(),
  s3Key: text("s3_key").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // shirt, pants, dress, jacket, shoes, hat, accessory
  color: varchar("color", { length: 100 }),
  pattern: varchar("pattern", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  isOverlayable: boolean("is_overlayable").notNull().default(false),
  overlayConfidence: decimal("overlay_confidence", { precision: 5, scale: 2 }),
  analysisData: json("analysis_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Virtual Wardrobe table
export const virtualWardrobe = mysqlTable("virtual_wardrobe", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  garmentId: varchar("garment_id", { length: 36 }).notNull().references(() => garmentItems.id),
  position: int("position").notNull().default(0),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

// Try-On Sessions table
export const tryonSessions = mysqlTable("tryon_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  avatarId: varchar("avatar_id", { length: 36 }).notNull().references(() => userAvatars.id),
  garmentIds: json("garment_ids").$type<string[]>().notNull(),
  overlayGarmentIds: json("overlay_garment_ids").$type<string[]>().notNull(),
  promptGarmentIds: json("prompt_garment_ids").$type<string[]>().notNull(),
  renderQuality: varchar("render_quality", { length: 10 }).notNull(), // sd, hd, 4k
  backgroundScene: varchar("background_scene", { length: 50 }).notNull(), // studio, urban, outdoor, custom
  customBackgroundPrompt: text("custom_background_prompt"),
  status: varchar("status", { length: 30 }).notNull(), // queued, processing_avatar, applying_overlays, preview_ready, awaiting_confirmation, rendering_ai, completed, cancelled, failed
  progress: int("progress").notNull().default(0),
  previewExpiresAt: timestamp("preview_expires_at"),
  baseImageUrl: text("base_image_url"),
  renderedImageUrl: text("rendered_image_url"),
  creditsUsed: int("credits_used").notNull().default(0),
  usedQuota: boolean("used_quota").notNull().default(false),
  refundedCredits: int("refunded_credits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Gemini Batch Jobs table
// Tracks batch image generation requests submitted to Google Gemini Imagen 3 API
// Used for cost optimization by grouping multiple render requests into single API calls
export const geminiBatchJobs = mysqlTable("gemini_batch_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  // User and batch identification
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  batchId: text("batch_id").notNull(), // Gemini API batch identifier
  
  // Request tracking - JSON array of request IDs included in this batch
  // Example: ["req-123", "req-456", "req-789"]
  requestIds: json("request_ids").$type<string[]>().notNull(),
  
  // Batch status lifecycle: pending -> submitted -> processing -> completed | failed
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  
  // Timestamps for tracking batch progression
  submittedAt: timestamp("submitted_at"), // When batch was sent to Gemini API
  completedAt: timestamp("completed_at"), // When all images in batch finished processing
  
  // Gemini API details
  geminiBatchUrl: text("gemini_batch_url"), // URL for polling batch status
  
  // Cost tracking for budget controls
  costUsd: decimal("cost_usd", { precision: 10, scale: 4 }), // Actual cost from Gemini API
  imageCount: int("image_count").notNull(), // Number of images in batch
  
  // Error tracking
  errorMessage: text("error_message"), // Error details if batch fails
  retryCount: int("retry_count").notNull().default(0), // Number of retry attempts
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const generationSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  style: z.enum(["portrait", "fashion", "editorial", "commercial"]),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

export const createAvatarSchema = z.object({
  rpmAvatarId: z.string(),
  avatarGlbUrl: z.string().url(),
  avatarThumbnailUrl: z.string().url().optional(),
});

export const uploadGarmentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["shirt", "pants", "dress", "jacket", "shoes", "hat", "accessory"]),
});

export const createTryonSessionSchema = z.object({
  avatarId: z.string().uuid(),
  garmentIds: z.array(z.string().uuid()).min(1),
  renderQuality: z.enum(["sd", "hd", "4k"]).default("sd"),
  backgroundScene: z.enum(["studio", "urban", "outdoor", "custom"]).default("studio"),
  customBackgroundPrompt: z.string().max(200).optional(),
});

export const confirmPreviewSchema = z.object({
  approveOverlay: z.boolean(),
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type UserAvatar = typeof userAvatars.$inferSelect;
export type InsertUserAvatar = typeof userAvatars.$inferInsert;
export type GarmentItem = typeof garmentItems.$inferSelect;
export type InsertGarmentItem = typeof garmentItems.$inferInsert;
export type VirtualWardrobe = typeof virtualWardrobe.$inferSelect;
export type TryonSession = typeof tryonSessions.$inferSelect;
export type InsertTryonSession = typeof tryonSessions.$inferInsert;
export type GeminiBatchJob = typeof geminiBatchJobs.$inferSelect;
export type InsertGeminiBatchJob = typeof geminiBatchJobs.$inferInsert;

// Physical profile type for API responses
export type PhysicalProfile = {
  heightFeet: number | null;
  heightInches: number | null;
  ageRange: string | null;
  gender: string | null;
  bodyType: string | null;
  ethnicity: string | null;
  profileCompleted: boolean;
  profileCompletedAt: Date | null;
  stylePreferences: string[] | null;
  measurementSystem: string;
};


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
  autoConvertToPlan: varchar("auto_convert_to_plan", { length: 20 }).default("studio"), // 'studio', 'pro'
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

// User Photos table - for photo-based try-on workflow
export const userPhotos = mysqlTable("user_photos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  photoS3Key: text("photo_s3_key").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  photoType: varchar("photo_type", { length: 20 }).notNull().default("front"), // front, side, full-body
  smplProcessed: boolean("smpl_processed").notNull().default(false),
  smplDataUrl: text("smpl_data_url"),
  smplConfidence: decimal("smpl_confidence", { precision: 5, scale: 2 }),
  smplMetadata: json("smpl_metadata"),
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
  avatarId: varchar("avatar_id", { length: 36 }).references(() => userAvatars.id),
  photoId: varchar("photo_id", { length: 36 }).references(() => userPhotos.id),
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

// Organizations table - for enterprise multi-user accounts
export const organizations = mysqlTable("organizations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  
  // Owner/creator of the organization
  ownerId: varchar("owner_id", { length: 36 }).notNull().references(() => users.id),
  
  // Subscription and billing
  subscriptionTier: varchar("subscription_tier", { length: 20 }).notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  
  // Credits shared across organization members
  credits: int("credits").notNull().default(0),
  
  // API rate limits (requests per minute)
  apiRateLimit: int("api_rate_limit").notNull().default(60), // 60 req/min default
  
  // Organization status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, suspended, deleted
  
  // Contact and billing details
  billingEmail: varchar("billing_email", { length: 255 }),
  companyWebsite: text("company_website"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Organization Members table - tracks which users belong to which organizations
export const organizationMembers = mysqlTable("organization_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  
  // Role-based access control
  role: varchar("role", { length: 20 }).notNull().default("member"), // owner, admin, developer, member
  
  // Permissions for granular access control
  permissions: json("permissions").$type<string[]>().notNull().default(sql`(JSON_ARRAY())`),
  // Example permissions: ["api:read", "api:write", "apikeys:create", "apikeys:delete", "org:manage"]
  
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// API Keys table - for programmatic access to the service
export const apiKeys = mysqlTable("api_keys", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  // API key belongs to a user within an organization
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  
  // Key identification (display name for user reference)
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Hashed API key (never store plain text)
  // Format: gxai_live_xxx or gxai_test_xxx (prefix + random string)
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(), // First 8 chars for display (e.g., "gxai_liv")
  
  // Key type and environment
  environment: varchar("environment", { length: 10 }).notNull().default("live"), // live, test
  
  // Scopes define what the API key can access
  scopes: json("scopes").$type<string[]>().notNull().default(sql`(JSON_ARRAY())`),
  // Example scopes: ["tryon:create", "tryon:read", "photos:upload", "garments:upload", "wardrobe:read"]
  
  // Rate limiting per key (overrides org default if set)
  rateLimit: int("rate_limit"), // requests per minute (null = use org default)
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  requestCount: int("request_count").notNull().default(0),
  
  // Key lifecycle
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, revoked, expired
  expiresAt: timestamp("expires_at"), // null = never expires
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by", { length: 36 }).references(() => users.id),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// API Key Usage table - detailed per-request tracking for billing and analytics
export const apiKeyUsage = mysqlTable("api_key_usage", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  apiKeyId: varchar("api_key_id", { length: 36 }).notNull().references(() => apiKeys.id),
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  
  // Request details
  endpoint: varchar("endpoint", { length: 255 }).notNull(), // e.g., "/api/v1/tryon/sessions"
  method: varchar("method", { length: 10 }).notNull(), // GET, POST, PUT, DELETE
  statusCode: int("status_code").notNull(),
  
  // Resource usage
  creditsUsed: int("credits_used").notNull().default(0),
  processingTimeMs: int("processing_time_ms"),
  
  // Request metadata
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// External Customers table - for e-commerce checkout integration
// Stores customer data from partner e-commerce platforms
export const externalCustomers = mysqlTable("external_customers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  // Which organization/e-commerce company owns this customer
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  
  // External reference from partner's system (e.g., Shopify customer ID)
  externalCustomerId: varchar("external_customer_id", { length: 255 }).notNull(),
  
  // Customer info (optional, for better UX)
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  
  // Customer's uploaded photos for try-on
  photoUrls: json("photo_urls").$type<string[]>(), // Array of S3 URLs
  
  // Metadata from partner platform
  metadata: json("metadata"), // Store any additional data from partner
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Cart Try-On Sessions table - for checkout workflow integration
export const cartTryonSessions = mysqlTable("cart_tryon_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  // Organization that initiated this try-on
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  
  // External customer reference
  externalCustomerId: varchar("external_customer_id", { length: 36 }).notNull().references(() => externalCustomers.id),
  
  // Cart/order reference from partner's system
  cartId: varchar("cart_id", { length: 255 }).notNull(),
  
  // Products being tried on (from partner's catalog)
  cartItems: json("cart_items").$type<Array<{
    productId: string;
    variantId: string;
    name: string;
    imageUrl: string;
    category: string; // shirt, pants, dress, etc.
    quantity: number;
    price: number;
    currency: string;
  }>>().notNull(),
  
  // Customer's photo for try-on
  customerPhotoUrl: text("customer_photo_url").notNull(),
  customerPhotoS3Key: text("customer_photo_s3_key").notNull(),
  
  // Try-on configuration
  renderQuality: varchar("render_quality", { length: 10 }).notNull().default("hd"), // sd, hd, 4k
  backgroundScene: varchar("background_scene", { length: 50 }).notNull().default("studio"),
  
  // Processing status
  status: varchar("status", { length: 30 }).notNull().default("queued"),
  progress: int("progress").notNull().default(0),
  
  // Results
  renderedImageUrl: text("rendered_image_url"),
  
  // Webhook for notifying partner when complete
  webhookUrl: text("webhook_url"),
  webhookDelivered: boolean("webhook_delivered").notNull().default(false),
  webhookDeliveredAt: timestamp("webhook_delivered_at"),
  
  // Analytics
  creditsUsed: int("credits_used").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Webhook Configurations table - for event notifications to partners
export const webhookConfigurations = mysqlTable("webhook_configurations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
  
  // Webhook details
  url: text("url").notNull(),
  secret: text("secret").notNull(), // For HMAC signature verification
  
  // Events to subscribe to
  events: json("events").$type<string[]>().notNull(),
  // Example events: ["tryon.completed", "tryon.failed", "credits.low"]
  
  // Status and monitoring
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, disabled
  failureCount: int("failure_count").notNull().default(0),
  lastFailureAt: timestamp("last_failure_at"),
  lastSuccessAt: timestamp("last_success_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email().max(255),
  password: z.string().min(1),
});

export const generationSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  style: z.enum(["portrait", "fashion", "editorial", "commercial", "street", "candid"]),
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

export const uploadPhotoSchema = z.object({
  photoType: z.enum(["front", "side", "full-body"]).default("front"),
});

export const createTryonSessionSchema = z.object({
  avatarId: z.string().uuid().optional(),
  photoId: z.string().uuid().optional(),
  garmentIds: z.array(z.string().uuid()).min(1),
  renderQuality: z.enum(["sd", "hd", "4k"]).default("sd"),
  backgroundScene: z.enum(["studio", "urban", "outdoor", "custom"]).default("studio"),
  customBackgroundPrompt: z.string().max(200).optional(),
}).refine(
  (data) => (data.avatarId && !data.photoId) || (!data.avatarId && data.photoId),
  { message: "Either avatarId or photoId must be provided, but not both" }
);

export const confirmPreviewSchema = z.object({
  approveOverlay: z.boolean(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/),
  billingEmail: z.string().email().optional(),
  companyWebsite: z.string().url().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  scopes: z.array(z.string()).min(1),
  environment: z.enum(["live", "test"]).default("live"),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "developer", "member"]).default("member"),
  permissions: z.array(z.string()).optional(),
});

export const createCartTryonSchema = z.object({
  externalCustomerId: z.string().min(1).max(255),
  cartId: z.string().min(1).max(255),
  cartItems: z.array(z.object({
    productId: z.string(),
    variantId: z.string(),
    name: z.string(),
    imageUrl: z.string().url(),
    category: z.enum(["shirt", "pants", "dress", "jacket", "shoes", "hat", "accessory"]),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    currency: z.string().length(3),
  })).min(1),
  customerPhoto: z.string().url(),
  renderQuality: z.enum(["sd", "hd", "4k"]).default("hd"),
  backgroundScene: z.enum(["studio", "urban", "outdoor", "custom"]).default("studio"),
  webhookUrl: z.string().url().optional(),
});

export const createExternalCustomerSchema = z.object({
  externalCustomerId: z.string().min(1).max(255),
  email: z.string().email().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  metadata: z.record(z.any()).optional(),
});

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
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
export type UserPhoto = typeof userPhotos.$inferSelect;
export type InsertUserPhoto = typeof userPhotos.$inferInsert;
export type GarmentItem = typeof garmentItems.$inferSelect;
export type InsertGarmentItem = typeof garmentItems.$inferInsert;
export type VirtualWardrobe = typeof virtualWardrobe.$inferSelect;
export type TryonSession = typeof tryonSessions.$inferSelect;
export type InsertTryonSession = typeof tryonSessions.$inferInsert;
export type GeminiBatchJob = typeof geminiBatchJobs.$inferSelect;
export type InsertGeminiBatchJob = typeof geminiBatchJobs.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type InsertApiKeyUsage = typeof apiKeyUsage.$inferInsert;
export type ExternalCustomer = typeof externalCustomers.$inferSelect;
export type InsertExternalCustomer = typeof externalCustomers.$inferInsert;
export type CartTryonSession = typeof cartTryonSessions.$inferSelect;
export type InsertCartTryonSession = typeof cartTryonSessions.$inferInsert;
export type WebhookConfiguration = typeof webhookConfigurations.$inferSelect;
export type InsertWebhookConfiguration = typeof webhookConfigurations.$inferInsert;

// Payment Transactions table - tracks all payment activity
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // 'subscription', 'credit_purchase', 'refund', 'chargeback'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Amount in USD
  creditsAmount: int("credits_amount"), // Credits added/refunded (if applicable)
  stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'completed', 'failed', 'refunded'
  metadata: json("metadata"), // Additional transaction details
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Credit Purchases table - tracks one-time credit purchases
export const creditPurchases = mysqlTable("credit_purchases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  creditsPurchased: int("credits_purchased").notNull(),
  bonusCredits: int("bonus_credits").notNull().default(0),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(), // Amount in USD
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'completed', 'failed', 'refunded'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type InsertCreditPurchase = typeof creditPurchases.$inferInsert;

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


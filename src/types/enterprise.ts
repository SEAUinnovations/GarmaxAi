import { Request } from 'express';
import type { 
  Organization, 
  OrganizationMember, 
  ApiKey, 
  ExternalCustomer, 
  CartTryonSession,
  WebhookConfiguration 
} from '@shared/schema';

/**
 * Extended Request interface for API key authenticated routes
 */
export interface ApiKeyRequest extends Request {
  organizationId?: string;
  apiKeyId?: string;
  apiKeyScopes?: ApiKeyScope[];
  apiKeyRateLimit?: number;
  organization?: Organization;
}

/**
 * Extended Request interface for organization-aware routes
 */
export interface EnterpriseAuthRequest extends Request {
  user?: { id: string; email: string };
  organization?: Organization;
  organizationMember?: OrganizationMember;
}

/**
 * API key scopes - defines what operations an API key can perform
 */
export type ApiKeyScope = 
  | 'tryon:create'      // Create cart try-on sessions
  | 'tryon:read'        // Read try-on session status
  | 'photos:upload'     // Upload customer photos
  | 'photos:read'       // Read photo URLs
  | 'customers:create'  // Create/update external customers
  | 'customers:read'    // Read customer data
  | 'garments:upload'   // Upload garment images (future)
  | 'garments:read'     // Read garment data (future)
  | 'webhooks:manage'   // Manage webhook configurations
  | 'all';              // Full access (use sparingly)

/**
 * Organization member roles
 */
export type OrganizationRole = 'owner' | 'admin' | 'developer' | 'member';

/**
 * Organization member permissions
 */
export type OrganizationPermission =
  | 'api:read'          // View API usage
  | 'api:write'         // Make API calls
  | 'apikeys:create'    // Create API keys
  | 'apikeys:delete'    // Delete/revoke API keys
  | 'org:manage'        // Manage organization settings
  | 'org:billing'       // View/manage billing
  | 'members:invite'    // Invite members
  | 'members:remove'    // Remove members
  | 'webhooks:manage';  // Configure webhooks

/**
 * Webhook event types
 */
export type WebhookEventType = 
  | 'tryon.completed'   // Try-on session completed successfully
  | 'tryon.failed'      // Try-on session failed
  | 'tryon.preview'     // Preview overlay generated
  | 'credits.low'       // Organization credits below threshold
  | 'credits.depleted'; // Organization out of credits

/**
 * Webhook event payload structure
 */
export interface WebhookEvent {
  event: WebhookEventType;
  timestamp: string;
  data: WebhookEventData;
}

/**
 * Webhook event data (varies by event type)
 */
export type WebhookEventData = 
  | TryonCompletedData 
  | TryonFailedData 
  | CreditsLowData;

export interface TryonCompletedData {
  sessionId: string;
  customerId: string;
  cartItems: CartItem[];
  resultImageUrl: string;
  creditsUsed: number;
  processingTimeMs: number;
}

export interface TryonFailedData {
  sessionId: string;
  customerId: string;
  error: string;
  errorCode: string;
  creditsRefunded: number;
}

export interface CreditsLowData {
  organizationId: string;
  creditsRemaining: number;
  threshold: number;
  estimatedDaysRemaining: number;
}

/**
 * Cart item structure for try-on sessions
 */
export interface CartItem {
  productId: string;           // Partner's product ID
  variantId?: string;           // Product variant (size, color)
  productName: string;          // Display name
  productImageUrl: string;      // URL to product image
  category?: string;            // Product category (top, bottom, dress, etc.)
  segmentationMask?: string;    // Optional pre-segmented garment mask
}

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  billingEmail?: string;
  companyWebsite?: string;
}

/**
 * Create API key request
 */
export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  environment: 'live' | 'test';
  scopes: ApiKeyScope[];
  rateLimit?: number;
  expiresAt?: string;
}

/**
 * Create cart try-on session request
 */
export interface CreateCartTryonRequest {
  customerId: string;           // External customer ID
  customerPhotoUrl: string;     // URL or S3 key of uploaded photo
  cartItems: CartItem[];        // Products to try on
  quality?: 'sd' | 'hd' | '4k'; // Render quality
  webhookUrl?: string;          // Optional webhook override
  metadata?: Record<string, any>; // Custom metadata
}

/**
 * Create external customer request
 */
export interface CreateExternalCustomerRequest {
  externalCustomerId: string;   // Partner's customer ID
  email?: string;
  name?: string;
  phoneNumber?: string;
  metadata?: Record<string, any>;
}

/**
 * Photo upload response
 */
export interface PhotoUploadResponse {
  photoId: string;
  photoUrl: string;
  s3Key: string;
  uploadedAt: string;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until reset
}

/**
 * API usage statistics
 */
export interface UsageStats {
  period: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCreditsUsed: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  errorsByCode: Record<string, number>;
}

/**
 * Webhook delivery attempt
 */
export interface WebhookDeliveryAttempt {
  attemptNumber: number;
  timestamp: string;
  statusCode?: number;
  error?: string;
  retryAfter?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

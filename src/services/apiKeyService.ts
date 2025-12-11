import { storage } from '../storage';
import { logger } from '../utils/winston-logger';
import type { ApiKey } from '@shared/schema';
import { 
  generateSecureApiKey, 
  hashApiKey,
  type ApiKeyEnvironment 
} from '../utils/apiKeyGenerator';
import type { 
  CreateApiKeyRequest 
} from '../types/enterprise';

/**
 * Service for API key management operations
 */
export class ApiKeyService {
  /**
   * Generate a new API key for an organization
   * Returns the full key (shown only once) and the created API key record
   */
  async generateApiKey(
    orgId: string,
    userId: string,
    data: CreateApiKeyRequest
  ): Promise<{ key: string; apiKey: ApiKey }> {
    try {
      // Generate secure API key
      const { key, hash, prefix } = await generateSecureApiKey(data.environment);

      // Create API key record
      const apiKey = await storage.createApiKey({
        userId,
        organizationId: orgId,
        name: data.name,
        description: data.description,
        keyHash: hash,
        keyPrefix: prefix,
        environment: data.environment,
        scopes: data.scopes,
        rateLimit: data.rateLimit,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        status: 'active',
        requestCount: 0,
      });

      logger.info(`API key created: ${apiKey.name} for org ${orgId}`, 'ApiKeyService');
      
      return { key, apiKey };
    } catch (error) {
      logger.error(`Error generating API key: ${error}`, 'ApiKeyService');
      throw error;
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKey(keyId: string): Promise<ApiKey | undefined> {
    return storage.getApiKey(keyId);
  }

  /**
   * List all API keys for an organization
   */
  async listApiKeys(orgId: string): Promise<ApiKey[]> {
    return storage.listOrganizationApiKeys(orgId);
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(
    keyId: string, 
    userId: string, 
    reason: string
  ): Promise<ApiKey> {
    try {
      const apiKey = await storage.revokeApiKey(keyId, userId, reason);
      logger.info(`API key revoked: ${keyId} by ${userId}`, 'ApiKeyService');
      return apiKey;
    } catch (error) {
      logger.error(`Error revoking API key ${keyId}: ${error}`, 'ApiKeyService');
      throw error;
    }
  }

  /**
   * Update API key metadata (name, description, scopes, rate limit)
   * Cannot update the key itself
   */
  async updateApiKey(
    keyId: string,
    data: {
      name?: string;
      description?: string;
      scopes?: string[];
      rateLimit?: number;
    }
  ): Promise<ApiKey> {
    try {
      return await storage.updateApiKey(keyId, data);
    } catch (error) {
      logger.error(`Error updating API key ${keyId}: ${error}`, 'ApiKeyService');
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyStats(keyId: string, days: number = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await storage.getApiKeyUsageStats(keyId, startDate, endDate);
    } catch (error) {
      logger.error(`Error getting API key stats: ${error}`, 'ApiKeyService');
      throw error;
    }
  }
}

export const apiKeyService = new ApiKeyService();

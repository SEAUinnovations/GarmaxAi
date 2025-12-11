import crypto from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const KEY_LENGTH = 32; // 32 bytes = 64 hex characters

export type ApiKeyEnvironment = 'live' | 'test';

interface GeneratedApiKey {
  key: string; // Full key to show user (only shown once)
  hash: string; // Bcrypt hash to store in database
  prefix: string; // First 12 chars for display (e.g., "gxai_liv_sk_")
}

/**
 * Generate a secure API key with format: gxai_{env}_sk_{random}
 * 
 * @param environment - 'live' or 'test'
 * @returns Object containing full key, hash, and prefix
 * 
 * @example
 * const { key, hash, prefix } = await generateSecureApiKey('live');
 * // key: "gxai_live_sk_a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"
 * // hash: "$2b$10$..." (bcrypt hash)
 * // prefix: "gxai_liv_sk_"
 */
export async function generateSecureApiKey(environment: ApiKeyEnvironment): Promise<GeneratedApiKey> {
  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  const randomHex = randomBytes.toString('hex');
  
  // Construct key with format: gxai_{env}_sk_{random}
  const key = `gxai_${environment}_sk_${randomHex}`;
  
  // Generate bcrypt hash
  const hash = await hashApiKey(key);
  
  // Extract prefix for display (first 12 chars)
  const prefix = key.substring(0, 12);
  
  return { key, hash, prefix };
}

/**
 * Hash an API key using bcrypt
 * 
 * @param key - Plain text API key
 * @returns Bcrypt hash
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

/**
 * Verify an API key against its hash
 * 
 * @param key - Plain text API key to verify
 * @param hash - Bcrypt hash from database
 * @returns True if key matches hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(key, hash);
  } catch (error) {
    console.error('Error verifying API key:', error);
    return false;
  }
}

/**
 * Validate API key format
 * 
 * @param key - API key to validate
 * @returns True if format is valid
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Format: gxai_{live|test}_sk_{64 hex chars}
  const pattern = /^gxai_(live|test)_sk_[a-f0-9]{64}$/;
  return pattern.test(key);
}

/**
 * Extract environment from API key
 * 
 * @param key - API key
 * @returns 'live', 'test', or null if invalid
 */
export function extractEnvironment(key: string): ApiKeyEnvironment | null {
  if (key.startsWith('gxai_live_')) return 'live';
  if (key.startsWith('gxai_test_')) return 'test';
  return null;
}

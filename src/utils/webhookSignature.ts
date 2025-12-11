import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * 
 * @param payload - JSON stringified payload
 * @param secret - Webhook secret key
 * @returns Hex-encoded HMAC signature
 * 
 * @example
 * const signature = generateSignature(JSON.stringify(data), webhookSecret);
 * // Returns: "a1b2c3d4e5f67890..."
 */
export function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 * 
 * @param payload - JSON stringified payload
 * @param signature - Signature from X-GarmaxAI-Signature header
 * @param secret - Webhook secret key
 * @returns True if signature is valid
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret);
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // If signatures have different lengths, timingSafeEqual throws
    return false;
  }
}

/**
 * Generate a secure webhook secret
 * 
 * @returns 32-byte hex string (64 characters)
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create webhook payload with timestamp and signature
 * 
 * @param event - Event type
 * @param data - Event data
 * @param secret - Webhook secret
 * @returns Object with payload, timestamp, and signature
 */
export function createWebhookPayload(event: string, data: any, secret: string) {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({
    event,
    timestamp,
    data,
  });
  
  const signature = generateSignature(payload, secret);
  
  return {
    payload,
    timestamp,
    signature,
  };
}

/**
 * Verify webhook timestamp is recent (within 5 minutes)
 * Prevents replay attacks
 * 
 * @param timestamp - ISO timestamp from webhook
 * @param maxAgeMinutes - Maximum age in minutes (default: 5)
 * @returns True if timestamp is recent
 */
export function isRecentTimestamp(timestamp: string, maxAgeMinutes: number = 5): boolean {
  try {
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    
    return (now - webhookTime) <= maxAge;
  } catch (error) {
    return false;
  }
}

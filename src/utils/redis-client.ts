import Redis from 'ioredis';
import { logger } from './winston-logger';

class RedisClient {
  private client: Redis | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  
  constructor() {
    this.connect();
  }
  
  private connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        enableOfflineQueue: false,
        reconnectOnError: (err) => {
          logger.warn(`Redis connection error, attempting reconnect: ${err.message}`, 'RedisClient');
          return true; // Attempt to reconnect
        },
        retryStrategy: (times: number) => {
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, max 10s
          if (times > this.maxReconnectAttempts) {
            logger.error(`Max Redis reconnection attempts (${this.maxReconnectAttempts}) reached`, 'RedisClient');
            this.openCircuitBreaker();
            return null; // Stop retrying
          }
          
          const delay = Math.min(100 * Math.pow(2, times - 1), 10000);
          logger.info(`Redis reconnection attempt ${times}, delay: ${delay}ms`, 'RedisClient');
          return delay;
        },
      });
      
      this.client.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.circuitBreakerOpen = false;
        logger.info('Connected to Redis', 'RedisClient');
      });
      
      this.client.on('ready', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.circuitBreakerOpen = false;
        logger.info('Redis client ready', 'RedisClient');
      });
      
      this.client.on('error', (error) => {
        this.connected = false;
        this.reconnectAttempts++;
        logger.error(`Redis connection error (attempt ${this.reconnectAttempts}): ${error}`, 'RedisClient');
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.openCircuitBreaker();
        }
      });
      
      this.client.on('close', () => {
        this.connected = false;
        logger.warn('Redis connection closed', 'RedisClient');
      });
      
      this.client.on('reconnecting', (delay: number) => {
        logger.info(`Redis reconnecting in ${delay}ms...`, 'RedisClient');
      });
      
    } catch (error) {
      logger.error(`Failed to initialize Redis client: ${error}`, 'RedisClient');
      this.openCircuitBreaker();
    }
  }
  
  /**
   * Open circuit breaker to prevent cascading failures
   * Will auto-reset after timeout
   */
  private openCircuitBreaker() {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
    logger.warn(`Redis circuit breaker OPEN - will reset in ${this.CIRCUIT_BREAKER_TIMEOUT/1000}s`, 'RedisClient');
    
    // Attempt to reset after timeout
    setTimeout(() => {
      this.attemptCircuitBreakerReset();
    }, this.CIRCUIT_BREAKER_TIMEOUT);
  }
  
  /**
   * Attempt to reset circuit breaker and reconnect
   */
  private attemptCircuitBreakerReset() {
    if (Date.now() >= this.circuitBreakerResetTime) {
      logger.info('Attempting to reset Redis circuit breaker and reconnect...', 'RedisClient');
      this.reconnectAttempts = 0;
      this.circuitBreakerOpen = false;
      
      // Attempt reconnection
      if (!this.connected && this.client) {
        this.client.connect().catch((error) => {
          logger.error(`Circuit breaker reset failed: ${error}`, 'RedisClient');
          this.openCircuitBreaker(); // Re-open if reconnection fails
        });
      }
    }
  }
  
  /**
   * Check if Redis operations should be allowed
   */
  private isOperational(): boolean {
    // If circuit breaker is open and reset time has passed, try to reset
    if (this.circuitBreakerOpen && Date.now() >= this.circuitBreakerResetTime) {
      this.attemptCircuitBreakerReset();
    }
    
    if (this.circuitBreakerOpen) {
      logger.warn('Redis circuit breaker is OPEN - operation blocked', 'RedisClient');
      return false;
    }
    
    if (!this.client || !this.connected) {
      logger.warn('Redis not connected - operation skipped', 'RedisClient');
      return false;
    }
    
    return true;
  }
  
  async get(key: string): Promise<string | null> {
    if (!this.isOperational()) {
      return null;
    }
    
    try {
      return await this.client!.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}: ${error}`, 'RedisClient');
      return null;
    }
  }
  
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isOperational()) {
      return false;
    }
    
    try {
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}: ${error}`, 'RedisClient');
      return false;
    }
  }
  
  async del(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      logger.warn('Redis not connected, skipping DEL operation', 'RedisClient');
      return false;
    }
    
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}: ${error}`, 'RedisClient');
      return false;
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }
    
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}: ${error}`, 'RedisClient');
      return false;
    }
  }
  
  async incr(key: string): Promise<number | null> {
    if (!this.client || !this.connected) {
      return null;
    }
    
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}: ${error}`, 'RedisClient');
      return null;
    }
  }
  
  async hset(hash: string, field: string, value: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }
    
    try {
      await this.client.hset(hash, field, value);
      return true;
    } catch (error) {
      logger.error(`Redis HSET error for hash ${hash}, field ${field}: ${error}`, 'RedisClient');
      return false;
    }
  }
  
  async hget(hash: string, field: string): Promise<string | null> {
    if (!this.client || !this.connected) {
      return null;
    }
    
    try {
      return await this.client.hget(hash, field);
    } catch (error) {
      logger.error(`Redis HGET error for hash ${hash}, field ${field}: ${error}`, 'RedisClient');
      return null;
    }
  }
  
  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.connected) {
      return [];
    }
    
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}: ${error}`, 'RedisClient');
      return [];
    }
  }
  
  async flushPattern(pattern: string): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }
    
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(...keys);
      logger.info(`Deleted ${result} keys matching pattern ${pattern}`, 'RedisClient');
      return result;
    } catch (error) {
      logger.error(`Redis flush pattern error for ${pattern}: ${error}`, 'RedisClient');
      return 0;
    }
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.connected = false;
      logger.info('Disconnected from Redis', 'RedisClient');
    }
  }
}

export const redisClient = new RedisClient();
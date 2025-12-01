// Mock Redis implementation for testing
class MockRedis {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, NodeJS.Timeout> = new Map();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, ex?: number): Promise<'OK'> {
    this.data.set(key, value);
    
    // Clear existing expiration
    const existingTimeout = this.expirations.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new expiration if provided
    if (ex) {
      const timeout = setTimeout(() => {
        this.data.delete(key);
        this.expirations.delete(key);
      }, ex * 1000);
      this.expirations.set(key, timeout);
    }
    
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    
    // Clear expiration
    const timeout = this.expirations.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.expirations.delete(key);
    }
    
    return existed ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async flushall(): Promise<'OK'> {
    this.data.clear();
    
    // Clear all expirations
    for (const timeout of this.expirations.values()) {
      clearTimeout(timeout);
    }
    this.expirations.clear();
    
    return 'OK';
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.data.has(key)) {
      return 0;
    }

    // Clear existing expiration
    const existingTimeout = this.expirations.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new expiration
    const timeout = setTimeout(() => {
      this.data.delete(key);
      this.expirations.delete(key);
    }, seconds * 1000);
    this.expirations.set(key, timeout);

    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.data.has(key)) {
      return -2; // Key doesn't exist
    }
    
    if (!this.expirations.has(key)) {
      return -1; // Key exists but has no expiration
    }
    
    // For simplicity, return a mock TTL
    return 60;
  }
}

export default MockRedis;
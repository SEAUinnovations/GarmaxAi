import { IStorage } from '../storage';
import { MemStorage } from './memStorage';
import { RDSStorage } from './rdsStorage';
import { logger } from '../utils/winston-logger';

export class StorageFactory {
  private static storageInstance: IStorage | null = null;

  static async getStorage(): Promise<IStorage> {
    if (StorageFactory.storageInstance) {
      return StorageFactory.storageInstance;
    }

    const environment = process.env.NODE_ENV || 'development';
    logger.info(`Initializing storage for environment: ${environment}`, 'StorageFactory');

    // For development/testing, always use MemStorage
    if (environment === 'development' || environment === 'test') {
      StorageFactory.storageInstance = new MemStorage();
      logger.info('Memory storage initialized for development', 'StorageFactory');
      return StorageFactory.storageInstance;
    }

    // For production/staging, try RDS first, fallback to MemStorage
    if (environment === 'production' || environment === 'staging') {
      const connectionString = StorageFactory.buildRDSConnectionString();
      if (!connectionString) {
        logger.error('RDS connection string not available, falling back to memory storage', 'StorageFactory');
        StorageFactory.storageInstance = new MemStorage();
      } else {
        try {
          const rdsStorage = new RDSStorage(connectionString);
          await rdsStorage.connect();
          StorageFactory.storageInstance = rdsStorage;
          logger.info('RDS storage initialized successfully', 'StorageFactory');
        } catch (error) {
          logger.error(`Failed to initialize RDS storage: ${error}`, 'StorageFactory');
          logger.info('Falling back to memory storage', 'StorageFactory');
          StorageFactory.storageInstance = new MemStorage();
        }
      }
    }

    return StorageFactory.storageInstance || new MemStorage();
  }

  private static buildRDSConnectionString(): string | null {
    const host = process.env.RDS_HOST;
    const port = process.env.RDS_PORT || '3306';
    const database = process.env.RDS_DATABASE;
    const username = process.env.RDS_USERNAME;
    const password = process.env.RDS_PASSWORD;

    if (!host || !database || !username || !password) {
      logger.warn('Missing RDS configuration environment variables', 'StorageFactory');
      return null;
    }

    return `mysql://${username}:${password}@${host}:${port}/${database}`;
  }

  // Method to reset storage instance (useful for testing)
  static resetStorage(): void {
    if (StorageFactory.storageInstance && 'disconnect' in StorageFactory.storageInstance) {
      (StorageFactory.storageInstance as RDSStorage).disconnect();
    }
    StorageFactory.storageInstance = null;
  }

  // Health check method
  static async healthCheck(): Promise<{
    storage: string;
    healthy: boolean;
    environment: string;
  }> {
    const environment = process.env.NODE_ENV || 'development';
    const storage = StorageFactory.storageInstance;

    if (!storage) {
      return {
        storage: 'uninitialized',
        healthy: false,
        environment
      };
    }

    try {
      // Simple health check by trying to get a non-existent user
      await storage.getUser('health-check-test');
      
      return {
        storage: storage instanceof RDSStorage ? 'rds' : 'memory',
        healthy: true,
        environment
      };
    } catch (error) {
      return {
        storage: storage instanceof RDSStorage ? 'rds' : 'memory',
        healthy: false,
        environment
      };
    }
  }
}

// Export database instance for direct access (needed by some services)
export let db: any = null;

// Initialize db connection when storage is created
export const initializeDB = async () => {
  const storage = await StorageFactory.getStorage();
  if (storage instanceof RDSStorage) {
    db = (storage as RDSStorage).db;
  }
  return db;
};

// Auto-initialize db when module is loaded
initializeDB().catch(err => logger.error(`Failed to initialize DB: ${err}`, 'StorageFactory'));
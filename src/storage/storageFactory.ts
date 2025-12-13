import { IStorage } from '../storage';
import { MemStorage } from './memStorage';
import { RDSStorage } from './rdsStorage';
import { logger } from '../utils/winston-logger';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class StorageFactory {
  private static storageInstance: IStorage | null = null;

  static async getStorage(): Promise<IStorage> {
    if (StorageFactory.storageInstance) {
      return StorageFactory.storageInstance;
    }

    const environment = process.env.NODE_ENV || 'development';
    const isLocal = !process.env.AWS_REGION || process.env.IS_LOCAL === 'true';
    
    logger.info(`Initializing storage for environment: ${environment}, isLocal: ${isLocal}`, 'StorageFactory');

    // For local development/testing, always use MemStorage
    if (isLocal || environment === 'test') {
      StorageFactory.storageInstance = new MemStorage();
      logger.info('Memory storage initialized for local development', 'StorageFactory');
      return StorageFactory.storageInstance;
    }

    // For AWS deployment (production/staging/qa/dev), use RDS
    try {
      const connectionString = await StorageFactory.buildRDSConnectionString();
      if (!connectionString) {
        logger.error('RDS connection string not available, falling back to memory storage', 'StorageFactory');
        StorageFactory.storageInstance = new MemStorage();
      } else {
        const rdsStorage = new RDSStorage(connectionString);
        await rdsStorage.connect();
        StorageFactory.storageInstance = rdsStorage;
        logger.info('RDS storage initialized successfully', 'StorageFactory');
      }
    } catch (error) {
      logger.error(`Failed to initialize RDS storage: ${error}`, 'StorageFactory');
      logger.info('Falling back to memory storage', 'StorageFactory');
      StorageFactory.storageInstance = new MemStorage();
    }

    return StorageFactory.storageInstance || new MemStorage();
  }

  private static async buildRDSConnectionString(): Promise<string | null> {
    // Check for local development DATABASE_URL first
    if (process.env.DATABASE_URL) {
      logger.info('Using DATABASE_URL from environment', 'StorageFactory');
      return process.env.DATABASE_URL;
    }

    // Check if we have RDS endpoint from environment (set by CDK)
    const host = process.env.RDS_ENDPOINT;
    const secretArn = process.env.DATABASE_SECRET_ARN;
    const database = process.env.RDS_DATABASE || 'garmaxai';

    if (!host) {
      logger.warn('RDS_ENDPOINT not set', 'StorageFactory');
      return null;
    }

    // Get credentials from Secrets Manager
    if (secretArn) {
      try {
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
        
        if (!response.SecretString) {
          logger.error('Secret value is empty', 'StorageFactory');
          return null;
        }

        const secret = JSON.parse(response.SecretString);
        const username = secret.username || 'dbadmin';
        const password = secret.password;
        const port = secret.port || '3306';

        if (!password) {
          logger.error('Password not found in secret', 'StorageFactory');
          return null;
        }

        logger.info(`Building RDS connection string for ${host}/${database}`, 'StorageFactory');
        return `mysql://${username}:${password}@${host}:${port}/${database}`;
      } catch (error) {
        logger.error(`Failed to retrieve RDS credentials from Secrets Manager: ${error}`, 'StorageFactory');
        return null;
      }
    }

    // Fallback to environment variables (for local testing with RDS)
    const username = process.env.RDS_USERNAME;
    const password = process.env.RDS_PASSWORD;
    const port = process.env.RDS_PORT || '3306';

    if (!username || !password) {
      logger.warn('Missing RDS credentials in environment variables', 'StorageFactory');
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
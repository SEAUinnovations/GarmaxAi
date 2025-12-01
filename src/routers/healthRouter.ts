import { Router } from 'express';
import { StorageFactory } from '../storage/storageFactory';
import { MemStorage } from '../storage/memStorage';
import { logger } from '../utils/winston-logger';

const healthRouter = Router();

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
healthRouter.get('/', async (_req, res) => {
  try {
    // Simple health check without storage validation for now
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error(`Health check failed: ${error}`, 'HealthRouter');
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      error: 'Health check failed',
      uptime: process.uptime()
    });
  }
});

/**
 * @route GET /health/storage
 * @desc Detailed storage system health check
 * @access Public
 */
healthRouter.get('/storage', async (_req, res) => {
  try {
    const storage = await StorageFactory.getStorage();
    const storageType = storage instanceof MemStorage ? 'memory' : 'rds';
    
    res.json({
      storage: storageType,
      healthy: true,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Storage health check failed: ${error}`, 'HealthRouter');
    
    res.status(503).json({
      storage: 'error',
      healthy: false,
      environment: process.env.NODE_ENV || 'development',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export { healthRouter };
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/winston-logger';

const TEST_USER_EMAIL = 'bettstahlik@gmail.com';
const MIN_CREDIT_THRESHOLD = 1000;
const TOP_UP_AMOUNT = 10000;

/**
 * Middleware to ensure test user always has sufficient credits for end-to-end testing
 * This allows seamless testing of model generation workflows without manual credit management
 * 
 * TODO: BETA - Remove after QA/DEV environments are deployed
 * Currently enabled in ALL environments (including PROD) for internal testing during beta phase
 */
export async function ensureTestUserCredits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userEmail = (req as any).userEmail;
    const userId = (req as any).userId;

    // Check if this is the test user
    if (userEmail === TEST_USER_EMAIL && userId) {
      const user = await storage.getUserById(userId);

      if (user) {
        // Check creditsRemaining (not credits) as that's what the app uses
        const currentCredits = user.creditsRemaining ?? user.credits ?? 0;
        
        if (currentCredits < MIN_CREDIT_THRESHOLD) {
          await storage.updateUserCredits(user.id, TOP_UP_AMOUNT);
          const stage = process.env.STAGE?.toUpperCase() || 'LOCAL';
          logger.info(
            `[TEST USER - BETA${stage === 'PROD' ? ' - PROD INTERNAL TESTING' : ''}] Auto-topped up credits for ${TEST_USER_EMAIL}: ${currentCredits} → ${TOP_UP_AMOUNT}`,
            'testUserCredits'
          );
        } else {
          logger.debug(
            `[TEST USER - BETA] ${TEST_USER_EMAIL} has sufficient credits: ${currentCredits}`,
            'testUserCredits'
          );
        }
      } else {
        logger.warn(
          `[TEST USER - BETA] User not found in database for ${TEST_USER_EMAIL} with userId ${userId}`,
          'testUserCredits'
        );
      }
    } else if (userEmail === TEST_USER_EMAIL && !userId) {
      logger.warn(
        `[TEST USER - BETA] Test user email detected but no userId set. Email: ${userEmail}`,
        'testUserCredits'
      );
    }
  } catch (error) {
    // Log error but don't fail the request
    logger.error(
      `Failed to check/top-up test user credits: ${error}`,
      'testUserCredits'
    );
  }

  next();
}

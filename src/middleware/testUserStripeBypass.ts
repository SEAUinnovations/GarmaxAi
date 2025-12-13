import { Request, Response, NextFunction } from 'express';
import { creditsService } from '../services/creditsService';
import { logger } from '../utils/winston-logger';

/**
 * TODO: BETA - Remove after QA/DEV environments are deployed
 * 
 * Middleware to bypass Stripe checkout for test user credit purchases
 * Allows instant credit grants for bettstahlik@gmail.com during internal testing
 * 
 * Currently enabled in ALL environments (including PROD) during beta phase
 * This enables seamless testing of generation workflows without payment delays
 */

const TEST_USER_EMAIL = 'bettstahlik@gmail.com';

// Credit pack configurations (must match frontend Pricing.tsx and creditsController.ts)
const CREDIT_PACKS = {
  30: { price: 500, bonus: 0 }, // $5.00
  100: { price: 1500, bonus: 15 }, // $15.00 with 15 bonus
  500: { price: 6000, bonus: 150 }, // $60.00 with 150 bonus
};

export async function testUserStripeBypass(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userEmail = (req as any).userEmail;
    const userId = (req as any).userId;
    const { credits } = req.body;

    // Only bypass Stripe for test user
    if (userEmail !== TEST_USER_EMAIL) {
      return next();
    }

    // Validate credit pack
    const pack = CREDIT_PACKS[credits as keyof typeof CREDIT_PACKS];
    if (!pack) {
      res.status(400).json({ 
        error: "Invalid credit pack. Choose 30, 100, or 500 credits." 
      });
      return;
    }

    // Grant credits immediately without Stripe
    const totalCredits = credits + pack.bonus;
    await creditsService.addCredits(userId, totalCredits);

    const stage = process.env.STAGE?.toUpperCase() || 'LOCAL';
    logger.info(
      `[TEST USER - BETA${stage === 'PROD' ? ' - PROD INTERNAL TESTING' : ''}] Bypassed Stripe for ${TEST_USER_EMAIL}: Granted ${totalCredits} credits (${credits} + ${pack.bonus} bonus)`,
      'testUserStripeBypass'
    );

    // Return success response (mimics successful Stripe flow)
    res.status(200).json({
      success: true,
      message: 'Credits granted successfully (test user bypass)',
      creditsAdded: totalCredits,
      breakdown: {
        base: credits,
        bonus: pack.bonus,
        total: totalCredits
      }
    });
  } catch (error) {
    logger.error(
      `Test user Stripe bypass error: ${error}`,
      'testUserStripeBypass'
    );
    // On error, proceed to normal Stripe flow
    next();
  }
}

import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { creditsService } from "../services/creditsService";
import { logger } from "../utils/winston-logger";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5001';

// Credit pack pricing (aligned with frontend)
const CREDIT_PACKS = {
  30: { price: 500, bonus: 0 }, // $5.00
  100: { price: 1500, bonus: 15 }, // $15.00 with 15 bonus
  500: { price: 6000, bonus: 150 }, // $60.00 with 150 bonus
};

/**
 * @description Get user's credit balance
 * @param req - Express request object
 * @param res - Express response object
 */
export async function getCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const credits = await creditsService.getCredits(userId);

    res.status(200).json({
      credits,
    });
  } catch (error) {
    logger.error(`Get credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to fetch credits" });
  }
}

/**
 * @description Add credits to account (admin or payment endpoint)
 * @param req - Express request object
 * @param res - Express response object
 */
export async function addCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "Invalid credit amount" });
      return;
    }

    // TODO: Verify payment or admin status
    await creditsService.addCredits(userId, amount);

    const credits = await creditsService.getCredits(userId);

    logger.info(`Added ${amount} credits to user ${userId}`, "creditsController");

    res.status(200).json({
      message: "Credits added successfully",
      credits,
    });
  } catch (error) {
    logger.error(`Add credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to add credits" });
  }
}

/**
 * @description Check credit status
 * @param req - Express request object
 * @param res - Express response object
 */
export async function checkCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { required } = req.query;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requiredCredits = required ? parseInt(required as string) : 1;

    if (isNaN(requiredCredits) || requiredCredits < 1) {
      res.status(400).json({ error: "Invalid required amount" });
      return;
    }

    const hasCredits = await creditsService.hasCredits(userId, requiredCredits);
    const userCredits = await creditsService.getCredits(userId);

    res.status(200).json({
      hasCredits,
      required: requiredCredits,
      available: userCredits.available,
    });
  } catch (error) {
    logger.error(`Check credits error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to check credits" });
  }
}

/**
 * @description Create Stripe checkout session for credit purchase
 * @param req - Express request object
 * @param res - Express response object
 */
export async function createCreditPurchase(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { credits } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate credit pack
    const pack = CREDIT_PACKS[credits as keyof typeof CREDIT_PACKS];
    if (!pack) {
      res.status(400).json({ 
        error: "Invalid credit pack. Choose 30, 100, or 500 credits." 
      });
      return;
    }

    // Get user details
    const userCredits = await creditsService.getCredits(userId);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits + pack.bonus} Credits`,
              description: pack.bonus > 0 
                ? `${credits} credits + ${pack.bonus} bonus credits` 
                : `${credits} credits`,
            },
            unit_amount: pack.price, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        credits: credits.toString(),
        bonusCredits: pack.bonus.toString(),
        type: 'credit_purchase',
      },
    });

    logger.info(`Created credit purchase checkout for user ${userId}: ${credits} credits`, "creditsController");

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error(`Create credit purchase error: ${error}`, "creditsController");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}

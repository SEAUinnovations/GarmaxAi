import { Router, Request, Response } from "express";
import Stripe from "stripe";
import AWS from "aws-sdk";
import { logger } from "../utils/winston-logger";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

const eb = new AWS.EventBridge({
  region: process.env.AWS_REGION || "us-east-1",
});

router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = (req as any).rawBody as Buffer | undefined;

  if (!secret) return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
  if (!signature) return res.status(400).send("Missing Stripe signature");
  if (!raw || !Buffer.isBuffer(raw)) return res.status(400).send("Missing raw body");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret, 300);
  } catch (err) {
    return res.status(400).send(`Signature verification failed: ${(err as Error).message}`);
  }

  logger.info(`[stripe] received event: ${event.type} (${event.id})`);

  const busName = process.env.EVENTBRIDGE_BUS_NAME || `GarmaxAi-Tryon-${(process.env.NODE_ENV || "DEV").toUpperCase()}`;

  try {
    await eb
      .putEvents({
        Entries: [
          {
            EventBusName: busName,
            Source: "stripe",
            DetailType: event.type,
            Detail: JSON.stringify(event),
          },
        ],
      })
      .promise();
  } catch (e) {
    logger.error(`[stripe] failed to publish to EventBridge bus=${busName}: ${String(e)}`);
    // Acknowledge to Stripe to avoid retries; event was verified and can be replayed if needed
  }

  return res.status(200).json({ received: true });
});

export default router;

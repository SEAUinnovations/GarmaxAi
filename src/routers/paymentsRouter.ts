import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { logger } from "../utils/winston-logger";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

const eb = new EventBridgeClient({
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

  const STAGE = process.env.STAGE || 'dev';
  const busName = process.env.EVENTBRIDGE_BUS_NAME || `GarmaxAi-Tryon-${STAGE}`;

  try {
    await eb.send(new PutEventsCommand({
      Entries: [
        {
          EventBusName: busName,
          Source: "stripe",
          DetailType: event.type,
          Detail: JSON.stringify(event),
        },
      ],
    }));
    
    logger.info(`[stripe] published event ${event.id} to EventBridge bus ${busName}`);
    return res.status(200).json({ received: true });
  } catch (e) {
    logger.error(`[stripe] CRITICAL: failed to publish event ${event.id} to EventBridge bus=${busName}: ${String(e)}`);
    // Return 500 so Stripe will retry this webhook
    return res.status(500).send('EventBridge publish failed');
  }
});

// Verify payment session endpoint for frontend validation
router.get("/verify-session", async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id parameter" });
    }

    // Retrieve the session from Stripe to verify it exists and was paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: "Payment not completed",
        status: session.payment_status 
      });
    }

    return res.status(200).json({ 
      verified: true,
      status: session.payment_status,
      // Don't return sensitive details, webhook will handle credit/subscription activation
    });
  } catch (err) {
    logger.error(`[stripe] session verification failed: ${(err as Error).message}`);
    return res.status(500).json({ error: "Session verification failed" });
  }
});

export default router;

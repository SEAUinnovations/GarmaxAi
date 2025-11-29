import { Router } from "express";
import * as creditsController from "../controllers/creditsController";

const router = Router();

/**
 * @description GET /credits - Get user's credit balance
 */
router.get("/", creditsController.getCredits);

/**
 * @description POST /credits - Add credits to account
 */
router.post("/", creditsController.addCredits);

/**
 * @description GET /credits/check - Check if user has required credits
 */
router.get("/check", creditsController.checkCredits);

export default router;

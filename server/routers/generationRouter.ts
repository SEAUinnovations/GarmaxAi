import { Router } from "express";
import * as generationController from "../controllers/generationController";

const router = Router();

/**
 * @description POST /generation - Create a new image generation
 */
router.post("/", generationController.createGeneration);

/**
 * @description GET /generation - Get all user's generations
 */
router.get("/", generationController.getGenerations);

/**
 * @description GET /generation/:id - Get a specific generation
 */
router.get("/:id", generationController.getGeneration);

/**
 * @description DELETE /generation/:id - Cancel a generation
 */
router.delete("/:id", generationController.cancelGeneration);

export default router;

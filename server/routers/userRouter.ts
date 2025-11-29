import { Router } from "express";
import * as userController from "../controllers/userController";

const router = Router();

/**
 * @description GET /users/profile - Get authenticated user's profile
 */
router.get("/profile", userController.getProfile);

/**
 * @description PATCH /users/profile - Update authenticated user's profile
 */
router.patch("/profile", userController.updateProfile);

/**
 * @description GET /users/:userId - Get public user profile
 */
router.get("/:userId", userController.getPublicProfile);

export default router;

import { Router } from "express";
import * as authController from "../controllers/authController";

const router = Router();

/**
 * @description POST /auth/register - Register a new user
 */
router.post("/register", authController.register);

/**
 * @description POST /auth/login - Login user
 */
router.post("/login", authController.login);

/**
 * @description POST /auth/logout - Logout user
 */
router.post("/logout", authController.logout);

export default router;

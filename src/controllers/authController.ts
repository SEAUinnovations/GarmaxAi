import { Request, Response } from "express";
import { storage } from "../storage";
import { creditsService } from "../services/creditsService";
import { logger } from "../utils/winston-logger";
import { insertUserSchema } from "@shared/schema";

/**
 * @description Register a new user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate using Zod schema
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid registration data", details: parsed.error.errors });
      return;
    }

    const { username, email, password } = parsed.data;

    // Validate password strength
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }

    // Check if email already exists
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    // Create user
    const user = await storage.createUser({ username, email, password });

    // Award trial credits
    await creditsService.awardTrialCredits(user.id);

    logger.info(`User registered: ${user.id} (${username})`, "authController");

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    logger.error(`Registration error: ${error}`, "authController");
    res.status(500).json({ error: "Failed to register user" });
  }
}

/**
 * @description Login user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    // Check user exists and password matches
    const user = await storage.getUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // TODO: Use bcrypt to compare hashed passwords in production
    if (user.password !== password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    logger.info(`User logged in: ${user.id} (${username})`, "authController");

    // TODO: Generate JWT token in production
    res.status(200).json({
      message: "Login successful",
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    logger.error(`Login error: ${error}`, "authController");
    res.status(500).json({ error: "Failed to login" });
  }
}

/**
 * @description Logout user
 * @param req - Express request object
 * @param res - Express response object
 */
export async function logout(req: Request, res: Response) {
  try {
    // TODO: In production, invalidate JWT token
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error(`Logout error: ${error}`, "authController");
    res.status(500).json({ error: "Failed to logout" });
  }
}

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";

/**
 * Middleware to check if user is authenticated
 * In production, this should verify JWT tokens
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // For now, check if user object exists
  // In production, validate JWT token here
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * Middleware to set user from request headers/cookies
 * In production, this should extract and verify JWT tokens
 */
export function setUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Example: Extract user from authorization header or session
  // This is a placeholder - implement actual JWT verification in production
  const userId = (req.headers["x-user-id"] as string) || undefined;

  if (userId) {
    req.user = {
      id: userId,
      username: "", // Would be extracted from token in production
    };
  }

  next();
}

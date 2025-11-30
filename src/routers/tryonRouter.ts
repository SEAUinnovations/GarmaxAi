import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createTryonSession,
  getTryonSession,
  getUserTryonSessions,
  confirmPreview,
  cancelTryonSession,
} from "../controllers/tryonController";

export const tryonRouter = Router();

// All routes require authentication
tryonRouter.use(requireAuth);

// Try-on session routes
tryonRouter.post("/session/create", createTryonSession);
tryonRouter.get("/session/:sessionId", getTryonSession);
tryonRouter.get("/sessions", getUserTryonSessions);
tryonRouter.post("/session/:sessionId/confirm", confirmPreview);
tryonRouter.post("/session/:sessionId/cancel", cancelTryonSession);

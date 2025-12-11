import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import authRouter from "./routers/authRouter";
import userRouter from "./routers/userRouter";
import generationRouter from "./routers/generationRouter";
import creditsRouter from "./routers/creditsRouter";
import subscriptionsRouter from "./routers/subscriptionsRouter";
import { tryonRouter } from "./routers/tryonRouter";
import { avatarRouter } from "./routers/avatarRouter";
import { photoRouter } from "./routers/photoRouter";
import { garmentRouter } from "./routers/garmentRouter";
import { requestLogger } from "./middleware/requestLogger";
import { setUser, requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { initializeTryonWebSocket } from "./websocket/tryonWebSocket";
import paymentsRouter from "./routers/paymentsRouter";
import { healthRouter } from "./routers/healthRouter";
import analyticsRouter from "./routers/analyticsRouter";
import organizationsRouter from "./routers/organizationsRouter";
import apiKeysRouter from "./routers/apiKeysRouter";
import externalCustomersRouter from "./routers/externalCustomersRouter";
import enterprisePhotosRouter from "./routers/enterprisePhotosRouter";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(requestLogger);
  app.use(setUser);

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", requireAuth, userRouter);
  app.use("/api/generation", requireAuth, generationRouter);
  app.use("/api/credits", requireAuth, creditsRouter);
  app.use("/api/subscriptions", requireAuth, subscriptionsRouter);
  app.use("/api/tryon", tryonRouter);
  app.use("/api/tryon/avatars", avatarRouter);
  app.use("/api/tryon/photos", photoRouter);
  app.use("/api/tryon/garment", garmentRouter);
  app.use("/api", paymentsRouter);
  app.use("/api/analytics", requireAuth, analyticsRouter);
  
  // Enterprise API routes
  app.use("/api/organizations", organizationsRouter);
  app.use("/api/organizations/:orgId/api-keys", apiKeysRouter);
  
  // Enterprise API v1 routes (API key authenticated)
  app.use("/api/v1/customers", externalCustomersRouter);
  app.use("/api/v1/photos", enterprisePhotosRouter);
  
  // Health checks
  app.use("/api/health", healthRouter);

  // Error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  const httpServer = createServer(app);

  // Initialize WebSocket server
  initializeTryonWebSocket(httpServer);

  return httpServer;
}

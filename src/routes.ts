import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import authRouter from "./routers/authRouter";
import userRouter from "./routers/userRouter";
import generationRouter from "./routers/generationRouter";
import creditsRouter from "./routers/creditsRouter";
import { tryonRouter } from "./routers/tryonRouter";
import { avatarRouter } from "./routers/avatarRouter";
import { garmentRouter } from "./routers/garmentRouter";
import { requestLogger } from "./middleware/requestLogger";
import { setUser, requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { initializeTryonWebSocket } from "./websocket/tryonWebSocket";
import paymentsRouter from "./routers/paymentsRouter";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(requestLogger);
  app.use(setUser);

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", requireAuth, userRouter);
  app.use("/api/generation", requireAuth, generationRouter);
  app.use("/api/credits", requireAuth, creditsRouter);
  app.use("/api/tryon", tryonRouter);
  app.use("/api/tryon/avatars", avatarRouter);
  app.use("/api/tryon/garment", garmentRouter);
  app.use("/api", paymentsRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({ message: "Server is running" });
  });

  // Error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  const httpServer = createServer(app);

  // Initialize WebSocket server
  initializeTryonWebSocket(httpServer);

  return httpServer;
}

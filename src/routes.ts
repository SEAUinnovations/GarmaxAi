import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import authRouter from "./routers/authRouter";
import userRouter from "./routers/userRouter";
import generationRouter from "./routers/generationRouter";
import creditsRouter from "./routers/creditsRouter";
import { requestLogger } from "./middleware/requestLogger";
import { setUser, requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errorHandler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(requestLogger);
  app.use(setUser);

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", requireAuth, userRouter);
  app.use("/api/generation", requireAuth, generationRouter);
  app.use("/api/credits", requireAuth, creditsRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({ message: "Server is running" });
  });

  // Error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}

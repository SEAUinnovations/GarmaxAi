import type { Server } from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { logger } from "./utils/winston-logger";

export const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody?: unknown;
  }
}

// Middleware: CORS - Allow frontend origins
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5002',
  process.env.FRONTEND_URL,
].filter(Boolean);

logger.info(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`, 'CORS');
logger.info(`FRONTEND_URL environment variable: ${process.env.FRONTEND_URL}`, 'CORS');

app.use(cors({
  origin: (origin, callback) => {
    // For requests with no origin (mobile apps, Postman, server-to-server)
    // Use first allowed origin to avoid wildcard with credentials
    if (!origin) {
      logger.info('CORS: No origin header, allowing request', 'CORS');
      return callback(null, allowedOrigins[0] || true);
    }
    
    logger.info(`CORS checking origin: ${origin} against allowed: ${JSON.stringify(allowedOrigins)}`, 'CORS');
    
    if (allowedOrigins.includes(origin)) {
      logger.info(`CORS allowed origin: ${origin}`, 'CORS');
      callback(null, origin); // Return the specific origin, not just true
    } else {
      logger.warn(`CORS blocked origin: ${origin}. Allowed origins: ${JSON.stringify(allowedOrigins)}`, 'CORS');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
}));

// Middleware: Parse JSON with raw body preservation
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false }));

// Middleware: Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  let capturedResponse: Record<string, unknown> | undefined;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    capturedResponse = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;

    const duration = Date.now() - start;
    let logLine = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;

    if (capturedResponse) {
      logLine += ` :: ${JSON.stringify(capturedResponse)}`;
    }

    // Truncate long log lines
    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    logger.info(logLine);
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
): Promise<void> {
  const server = await registerRoutes(app);

  // Error handling middleware (must be last before setup)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as Record<string, unknown>;
    const status = typeof errObj.status === "number" ? errObj.status : 
                   typeof errObj.statusCode === "number" ? errObj.statusCode : 500;
    const message = typeof errObj.message === "string" ? errObj.message : "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Setup routes after all other middleware
  await setup(app, server);

  // Start server
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    logger.info(`serving on port ${port}`);
  });
}

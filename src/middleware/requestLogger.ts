import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/winston-logger";

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const path = req.path;

  // Track the original json method to capture response data
  const originalJson = res.json;
  let capturedResponse: unknown;

  res.json = function (body: unknown) {
    capturedResponse = body;
    return originalJson.call(this, body);
  };

  // Log when response is finished
  res.on("finish", () => {
    const duration = Date.now() - start;

    // Only log API routes
    if (path.startsWith("/api")) {
      let logMessage = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (capturedResponse) {
        const responseStr = JSON.stringify(capturedResponse);
        if (responseStr.length > 80) {
          logMessage += ` :: ${responseStr.slice(0, 79)}…`;
        } else {
          logMessage += ` :: ${responseStr}`;
        }
      }

      if (res.statusCode >= 400) {
        logger.warn(logMessage, "requestLogger");
      } else {
        logger.info(logMessage, "requestLogger");
      }
    }
  });

  next();
}

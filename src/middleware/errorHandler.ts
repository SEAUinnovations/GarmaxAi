import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/winston-logger";

export interface CustomError extends Error {
  statusCode?: number;
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(`${req.method} ${req.path} - ${message}`, "errorHandler");

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
  });
}

/**
 * 404 Not Found middleware
 */
export function notFound(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
}

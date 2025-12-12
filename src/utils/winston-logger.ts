import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Define custom format
const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  let logMessage = `${timestamp} [${level}]`;

  if (meta.source) {
    logMessage += ` [${meta.source}]`;
  }

  logMessage += ` ${message}`;

  if (meta.stack) {
    logMessage += `\n${meta.stack}`;
  }

  return logMessage;
});

// Detect Lambda environment
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;

// Configure transports based on environment
const transports: winston.transport[] = [
  // Console transport (always enabled, CloudWatch captures this in Lambda)
  new winston.transports.Console({
    format: combine(
      timestamp({ format: "HH:mm:ss" }),
      colorize(),
      customFormat
    ),
  }),
];

// Only add file transports when NOT running in Lambda
if (!isLambda) {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        customFormat
      ),
    }),
    // Combined log file
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        customFormat
      ),
    })
  );
}

// Create logger instance
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    colorize(),
    customFormat
  ),
  defaultMeta: { service: "modelmeai" },
  transports,
});

// Create logger interface with source parameter
export const logger = {
  info: (message: string, source = "express") =>
    winstonLogger.info(message, { source }),

  warn: (message: string, source = "express") =>
    winstonLogger.warn(message, { source }),

  error: (message: string, source = "express") =>
    winstonLogger.error(message, { source }),

  debug: (message: string, source = "express") =>
    winstonLogger.debug(message, { source }),

  // For raw winston access if needed
  raw: winstonLogger,
};

export default winstonLogger;

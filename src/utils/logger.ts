/**
 * Simple logger utility
 */

type LogLevel = "info" | "warn" | "error" | "debug";

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function log(message: string, level: LogLevel = "info", source = "express") {
  const timestamp = formatTime();
  const prefix = `${timestamp} [${source}] [${level.toUpperCase()}]`;

  switch (level) {
    case "error":
      console.error(`${prefix} ${message}`);
      break;
    case "warn":
      console.warn(`${prefix} ${message}`);
      break;
    case "debug":
      console.debug(`${prefix} ${message}`);
      break;
    case "info":
    default:
      console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info: (message: string, source?: string) => log(message, "info", source),
  warn: (message: string, source?: string) => log(message, "warn", source),
  error: (message: string, source?: string) => log(message, "error", source),
  debug: (message: string, source?: string) => log(message, "debug", source),
};

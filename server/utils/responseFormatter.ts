/**
 * Error response formatter
 */
export function formatError(message: string, statusCode: number = 500) {
  return {
    success: false,
    error: message,
    statusCode,
  };
}

/**
 * Success response formatter
 */
export function formatSuccess(data: any, message: string = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

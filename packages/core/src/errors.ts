/**
 * OpenRouter Auto - Error Handling
 * Comprehensive error handling for OpenRouter API
 */

import { OpenRouterError, OpenRouterErrorCode } from "./types";
import errorsRegistry from "../../registry/errors.json";

// Error code mapping from OpenRouter API responses
const ERROR_CODE_MAP: Record<string, OpenRouterErrorCode> =
  errorsRegistry.code_map as Record<string, OpenRouterErrorCode>;

// User-friendly error messages
const ERROR_MESSAGES: Record<OpenRouterErrorCode, string> =
  errorsRegistry.messages as Record<OpenRouterErrorCode, string>;

// Retryable error codes
const RETRYABLE_ERRORS: OpenRouterErrorCode[] =
  errorsRegistry.retryable as OpenRouterErrorCode[];

/**
 * Parse error from OpenRouter API response
 */
export function parseOpenRouterError(error: any): OpenRouterError {
  // Handle Axios errors
  if (error.response) {
    const statusCode = error.response.status?.toString();
    const errorData = error.response.data;

    // Try to extract error message from response
    let message =
      errorData?.error?.message ||
      errorData?.message ||
      error.message ||
      "Unknown error";

    // Map status code to error code
    let code = ERROR_CODE_MAP[statusCode] || "UNKNOWN";

    // Check for specific error patterns in message
    if (
      message.toLowerCase().includes("credit") ||
      message.toLowerCase().includes("balance")
    ) {
      code = "INSUFFICIENT_CREDITS";
    } else if (
      message.toLowerCase().includes("model") &&
      message.toLowerCase().includes("not found")
    ) {
      code = "MODEL_NOT_FOUND";
    } else if (
      message.toLowerCase().includes("rate limit") ||
      message.toLowerCase().includes("too many requests")
    ) {
      code = "RATE_LIMITED";
    } else if (
      message.toLowerCase().includes("invalid key") ||
      message.toLowerCase().includes("unauthorized")
    ) {
      code = "INVALID_API_KEY";
    }

    return {
      code,
      message:
        ERROR_MESSAGES[code] + (code === "UNKNOWN" ? ` (${message})` : ""),
      details: errorData,
      retryable: RETRYABLE_ERRORS.includes(code),
    };
  }

  // Handle network errors
  if (error.code) {
    const code = ERROR_CODE_MAP[error.code] || "NETWORK_ERROR";
    return {
      code,
      message: ERROR_MESSAGES[code],
      details: error,
      retryable: RETRYABLE_ERRORS.includes(code),
    };
  }

  // Handle timeout
  if (error.message?.toLowerCase().includes("timeout")) {
    return {
      code: "TIMEOUT",
      message: ERROR_MESSAGES.TIMEOUT,
      details: error,
      retryable: true,
    };
  }

  // Unknown error
  return {
    code: "UNKNOWN",
    message: ERROR_MESSAGES.UNKNOWN + ` (${error.message || "No details"})`,
    details: error,
    retryable: false,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: OpenRouterError): boolean {
  return error.retryable;
}

/**
 * Get retry delay for an error (exponential backoff)
 */
export function getRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: OpenRouterError): string {
  let display = `❌ ${error.message}`;

  const tip = (errorsRegistry.tips as Record<string, string>)[error.code];
  if (tip) {
    display += `\n💡 Tip: ${tip}`;
  }

  if (error.retryable) {
    display += "\n🔄 This error is retryable.";
  }

  return display;
}

/**
 * Error class for OpenRouter Auto SDK
 */
export class OpenRouterAutoError extends Error {
  public code: OpenRouterErrorCode;
  public details: any;
  public retryable: boolean;
  public timestamp: Date;

  constructor(error: OpenRouterError) {
    super(error.message);
    this.name = "OpenRouterAutoError";
    this.code = error.code;
    this.details = error.details;
    this.retryable = error.retryable;
    this.timestamp = new Date();
  }

  toString(): string {
    return formatErrorForDisplay({
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    });
  }
}

/**
 * Create error from HTTP response
 */
export function createErrorFromResponse(
  response: Response,
  body?: any,
): OpenRouterError {
  const statusCode = response.status.toString();
  const code = ERROR_CODE_MAP[statusCode] || "UNKNOWN";

  let message = body?.error?.message || body?.message || ERROR_MESSAGES[code];

  return {
    code,
    message,
    details: body,
    retryable: RETRYABLE_ERRORS.includes(code),
  };
}

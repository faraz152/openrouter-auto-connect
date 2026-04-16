/**
 * OpenRouter Auto - Error Handling
 * Comprehensive error handling for OpenRouter API
 */

import { OpenRouterError, OpenRouterErrorCode } from './types';

// Error code mapping from OpenRouter API responses
const ERROR_CODE_MAP: Record<string, OpenRouterErrorCode> = {
  '401': 'INVALID_API_KEY',
  '403': 'INVALID_API_KEY',
  '429': 'RATE_LIMITED',
  '404': 'MODEL_NOT_FOUND',
  '400': 'INVALID_PARAMETERS',
  '402': 'INSUFFICIENT_CREDITS',
  '500': 'PROVIDER_ERROR',
  '502': 'PROVIDER_ERROR',
  '503': 'PROVIDER_ERROR',
  '504': 'PROVIDER_ERROR',
  'ECONNREFUSED': 'NETWORK_ERROR',
  'ECONNRESET': 'NETWORK_ERROR',
  'ETIMEDOUT': 'TIMEOUT',
  'TIMEOUT': 'TIMEOUT',
};

// User-friendly error messages
const ERROR_MESSAGES: Record<OpenRouterErrorCode, string> = {
  INVALID_API_KEY: 'Invalid or missing API key. Please check your OpenRouter API key.',
  RATE_LIMITED: 'Rate limit exceeded. Please wait before making more requests.',
  MODEL_NOT_FOUND: 'Model not found. The model may have been removed or renamed.',
  MODEL_UNAVAILABLE: 'Model is currently unavailable. This is common with free models. Try a different model.',
  INVALID_PARAMETERS: 'Invalid parameters provided. Please check your request parameters.',
  INSUFFICIENT_CREDITS: 'Insufficient credits. Please add more credits to your OpenRouter account.',
  PROVIDER_ERROR: 'The model provider encountered an error. Please try again or use a different model.',
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  TIMEOUT: 'Request timed out. The model may be experiencing high load.',
  UNKNOWN: 'An unknown error occurred. Please try again.',
};

// Retryable error codes
const RETRYABLE_ERRORS: OpenRouterErrorCode[] = [
  'RATE_LIMITED',
  'PROVIDER_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
];

/**
 * Parse error from OpenRouter API response
 */
export function parseOpenRouterError(error: any): OpenRouterError {
  // Handle Axios errors
  if (error.response) {
    const statusCode = error.response.status?.toString();
    const errorData = error.response.data;
    
    // Try to extract error message from response
    let message = errorData?.error?.message || 
                  errorData?.message || 
                  error.message ||
                  'Unknown error';
    
    // Map status code to error code
    let code = ERROR_CODE_MAP[statusCode] || 'UNKNOWN';
    
    // Check for specific error patterns in message
    if (message.toLowerCase().includes('credit') || message.toLowerCase().includes('balance')) {
      code = 'INSUFFICIENT_CREDITS';
    } else if (message.toLowerCase().includes('model') && message.toLowerCase().includes('not found')) {
      code = 'MODEL_NOT_FOUND';
    } else if (message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('too many requests')) {
      code = 'RATE_LIMITED';
    } else if (message.toLowerCase().includes('invalid key') || message.toLowerCase().includes('unauthorized')) {
      code = 'INVALID_API_KEY';
    }
    
    return {
      code,
      message: ERROR_MESSAGES[code] + (code === 'UNKNOWN' ? ` (${message})` : ''),
      details: errorData,
      retryable: RETRYABLE_ERRORS.includes(code),
    };
  }
  
  // Handle network errors
  if (error.code) {
    const code = ERROR_CODE_MAP[error.code] || 'NETWORK_ERROR';
    return {
      code,
      message: ERROR_MESSAGES[code],
      details: error,
      retryable: RETRYABLE_ERRORS.includes(code),
    };
  }
  
  // Handle timeout
  if (error.message?.toLowerCase().includes('timeout')) {
    return {
      code: 'TIMEOUT',
      message: ERROR_MESSAGES.TIMEOUT,
      details: error,
      retryable: true,
    };
  }
  
  // Unknown error
  return {
    code: 'UNKNOWN',
    message: ERROR_MESSAGES.UNKNOWN + ` (${error.message || 'No details'})`,
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
export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: OpenRouterError): string {
  let display = `❌ ${error.message}`;
  
  if (error.code === 'RATE_LIMITED') {
    display += '\n💡 Tip: Wait a few seconds before retrying.';
  } else if (error.code === 'INSUFFICIENT_CREDITS') {
    display += '\n💡 Tip: Visit https://openrouter.ai/credits to add more credits.';
  } else if (error.code === 'MODEL_NOT_FOUND') {
    display += '\n💡 Tip: Try refreshing the model list to get the latest models.';
  } else if (error.code === 'MODEL_UNAVAILABLE') {
    display += '\n💡 Tip: Free models are often intermittently unavailable. Use or.getBestFreeModel() to find a working one, or pass { skipTest: true } to addModel() to bypass the check.';
  } else if (error.code === 'PROVIDER_ERROR') {
    display += '\n💡 Tip: This model may be temporarily unavailable. Try another model.';
  } else if (error.code === 'INVALID_PARAMETERS') {
    display += '\n💡 Tip: Check that your parameters are within the model\'s supported range.';
  }
  
  if (error.retryable) {
    display += '\n🔄 This error is retryable.';
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
    this.name = 'OpenRouterAutoError';
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
export function createErrorFromResponse(response: Response, body?: any): OpenRouterError {
  const statusCode = response.status.toString();
  const code = ERROR_CODE_MAP[statusCode] || 'UNKNOWN';
  
  let message = body?.error?.message || 
                body?.message || 
                ERROR_MESSAGES[code];
  
  return {
    code,
    message,
    details: body,
    retryable: RETRYABLE_ERRORS.includes(code),
  };
}

"""
OpenRouter Auto - Error Handling
Comprehensive error handling for OpenRouter API
"""

from typing import Dict, Any, Optional
from .types import OpenRouterError, OpenRouterErrorCode

# Error code mapping from HTTP status codes
ERROR_CODE_MAP: Dict[str, OpenRouterErrorCode] = {
    "401": OpenRouterErrorCode.INVALID_API_KEY,
    "403": OpenRouterErrorCode.INVALID_API_KEY,
    "429": OpenRouterErrorCode.RATE_LIMITED,
    "404": OpenRouterErrorCode.MODEL_NOT_FOUND,
    "400": OpenRouterErrorCode.INVALID_PARAMETERS,
    "402": OpenRouterErrorCode.INSUFFICIENT_CREDITS,
    "500": OpenRouterErrorCode.PROVIDER_ERROR,
    "502": OpenRouterErrorCode.PROVIDER_ERROR,
    "503": OpenRouterErrorCode.PROVIDER_ERROR,
    "504": OpenRouterErrorCode.PROVIDER_ERROR,
}

# User-friendly error messages
ERROR_MESSAGES: Dict[OpenRouterErrorCode, str] = {
    OpenRouterErrorCode.INVALID_API_KEY: "Invalid or missing API key. Please check your OpenRouter API key.",
    OpenRouterErrorCode.RATE_LIMITED: "Rate limit exceeded. Please wait before making more requests.",
    OpenRouterErrorCode.MODEL_NOT_FOUND: "Model not found. The model may have been removed or renamed.",
    OpenRouterErrorCode.INVALID_PARAMETERS: "Invalid parameters provided. Please check your request parameters.",
    OpenRouterErrorCode.INSUFFICIENT_CREDITS: "Insufficient credits. Please add more credits to your OpenRouter account.",
    OpenRouterErrorCode.PROVIDER_ERROR: "The model provider encountered an error. Please try again or use a different model.",
    OpenRouterErrorCode.NETWORK_ERROR: "Network error. Please check your internet connection.",
    OpenRouterErrorCode.TIMEOUT: "Request timed out. The model may be experiencing high load.",
    OpenRouterErrorCode.UNKNOWN: "An unknown error occurred. Please try again.",
}

# Retryable error codes
RETRYABLE_ERRORS = [
    OpenRouterErrorCode.RATE_LIMITED,
    OpenRouterErrorCode.PROVIDER_ERROR,
    OpenRouterErrorCode.NETWORK_ERROR,
    OpenRouterErrorCode.TIMEOUT,
]


class OpenRouterAutoError(Exception):
    """Custom exception for OpenRouter Auto SDK"""

    def __init__(self, error: OpenRouterError):
        super().__init__(error.message)
        self.code = error.code
        self.details = error.details
        self.retryable = error.retryable
        self.timestamp = __import__("datetime").datetime.now()

    def __str__(self) -> str:
        return format_error_for_display(
            OpenRouterError(
                code=self.code,
                message=str(self.args[0]),
                details=self.details,
                retryable=self.retryable,
            )
        )


def parse_openrouter_error(error: Exception, response: Optional[Any] = None) -> OpenRouterError:
    """Parse error from OpenRouter API response"""

    # Auto-extract response from httpx HTTPStatusError if not provided
    if response is None and hasattr(error, 'response'):
        response = error.response

    # Handle HTTP errors
    if response is not None:
        status_code = str(getattr(response, "status_code", ""))
        error_data = None

        try:
            error_data = response.json()
        except:
            pass

        # Get error message
        message = "Unknown error"
        if error_data:
            message = error_data.get("error", {}).get("message") or error_data.get("message") or str(error)
        else:
            message = str(error)

        # Map status code to error code
        code = ERROR_CODE_MAP.get(status_code, OpenRouterErrorCode.UNKNOWN)

        # Check for specific error patterns
        message_lower = message.lower()
        if "credit" in message_lower or "balance" in message_lower:
            code = OpenRouterErrorCode.INSUFFICIENT_CREDITS
        elif "model" in message_lower and "not found" in message_lower:
            code = OpenRouterErrorCode.MODEL_NOT_FOUND
        elif "rate limit" in message_lower or "too many requests" in message_lower:
            code = OpenRouterErrorCode.RATE_LIMITED
        elif "invalid key" in message_lower or "unauthorized" in message_lower:
            code = OpenRouterErrorCode.INVALID_API_KEY

        return OpenRouterError(
            code=code,
            message=ERROR_MESSAGES[code] + (f" ({message})" if code == OpenRouterErrorCode.UNKNOWN else ""),
            details=error_data,
            retryable=code in RETRYABLE_ERRORS,
        )

    # Handle network/connection errors
    error_str = str(error).lower()
    if "connection" in error_str or "network" in error_str:
        return OpenRouterError(
            code=OpenRouterErrorCode.NETWORK_ERROR,
            message=ERROR_MESSAGES[OpenRouterErrorCode.NETWORK_ERROR],
            details=str(error),
            retryable=True,
        )

    # Handle timeout
    if "timeout" in error_str:
        return OpenRouterError(
            code=OpenRouterErrorCode.TIMEOUT,
            message=ERROR_MESSAGES[OpenRouterErrorCode.TIMEOUT],
            details=str(error),
            retryable=True,
        )

    # Unknown error
    return OpenRouterError(
        code=OpenRouterErrorCode.UNKNOWN,
        message=ERROR_MESSAGES[OpenRouterErrorCode.UNKNOWN] + f" ({str(error)})",
        details=str(error),
        retryable=False,
    )


def is_retryable_error(error: OpenRouterError) -> bool:
    """Check if an error is retryable"""
    return error.retryable


def get_retry_delay(attempt: int, base_delay: float = 1.0) -> float:
    """Get retry delay using exponential backoff"""
    import math
    return min(base_delay * (2 ** attempt), 30.0)  # Max 30 seconds


def format_error_for_display(error: OpenRouterError) -> str:
    """Format error for display"""
    display = f"❌ {error.message}"

    tips = {
        OpenRouterErrorCode.RATE_LIMITED: "💡 Tip: Wait a few seconds before retrying.",
        OpenRouterErrorCode.INSUFFICIENT_CREDITS: "💡 Tip: Visit https://openrouter.ai/credits to add more credits.",
        OpenRouterErrorCode.MODEL_NOT_FOUND: "💡 Tip: Try refreshing the model list to get the latest models.",
        OpenRouterErrorCode.PROVIDER_ERROR: "💡 Tip: This model may be temporarily unavailable. Try another model.",
        OpenRouterErrorCode.INVALID_PARAMETERS: "💡 Tip: Check that your parameters are within the model's supported range.",
    }

    if error.code in tips:
        display += f"\n{tips[error.code]}"

    if error.retryable:
        display += "\n🔄 This error is retryable."

    return display

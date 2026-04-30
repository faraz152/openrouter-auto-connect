"""
OpenRouter Auto - Error Handling
Comprehensive error handling for OpenRouter API
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
from .types import OpenRouterError, OpenRouterErrorCode

_REGISTRY_DIR = Path(__file__).resolve().parent / "registry"
_errors_data = json.loads((_REGISTRY_DIR / "errors.json").read_text())

# Error code mapping from HTTP status codes (loaded from registry)
ERROR_CODE_MAP: Dict[str, OpenRouterErrorCode] = {
    k: OpenRouterErrorCode(v) for k, v in _errors_data["code_map"].items()
    if hasattr(OpenRouterErrorCode, v)
}

# User-friendly error messages (loaded from registry)
ERROR_MESSAGES: Dict[OpenRouterErrorCode, str] = {
    OpenRouterErrorCode(k): v for k, v in _errors_data["messages"].items()
    if hasattr(OpenRouterErrorCode, k)
}

# Retryable error codes (loaded from registry)
RETRYABLE_ERRORS = [
    OpenRouterErrorCode(c) for c in _errors_data["retryable"]
    if hasattr(OpenRouterErrorCode, c)
]

# Tips (loaded from registry for formatErrorForDisplay)
_TIPS: Dict[str, str] = _errors_data.get("tips", {})


class OpenRouterAutoError(Exception):
    """Custom exception for OpenRouter Auto SDK"""

    def __init__(self, error: OpenRouterError):
        super().__init__(error.message)
        # Normalise to plain string — enum members print as "OpenRouterErrorCode.X"
        # in Python 3.11+ when passed through str(), so always use .value
        self.code = error.code.value if isinstance(error.code, OpenRouterErrorCode) else str(error.code)
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
            details={"error_type": type(error).__name__},
            retryable=True,
        )

    # Handle timeout
    if "timeout" in error_str:
        return OpenRouterError(
            code=OpenRouterErrorCode.TIMEOUT,
            message=ERROR_MESSAGES[OpenRouterErrorCode.TIMEOUT],
            details={"error_type": type(error).__name__},
            retryable=True,
        )

    # Unknown error
    return OpenRouterError(
        code=OpenRouterErrorCode.UNKNOWN,
        message=ERROR_MESSAGES[OpenRouterErrorCode.UNKNOWN] + f" ({type(error).__name__})",
        details={"error_type": type(error).__name__},
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

    code_str = error.code.value if isinstance(error.code, OpenRouterErrorCode) else str(error.code)
    tip = _TIPS.get(code_str)
    if tip:
        display += f"\n💡 Tip: {tip}"

    if error.retryable:
        display += "\n🔄 This error is retryable."

    return display

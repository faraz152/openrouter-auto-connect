"""Tests for error handling"""

import pytest
from openrouter_auto.errors import (
    parse_openrouter_error,
    OpenRouterAutoError,
    is_retryable_error,
    get_retry_delay,
    format_error_for_display,
)
from openrouter_auto.types import OpenRouterError, OpenRouterErrorCode


class FakeResponse:
    """Fake HTTP response for testing"""

    def __init__(self, status_code: int, data: dict = None):
        self.status_code = status_code
        self._data = data or {}

    def json(self):
        return self._data


class FakeHTTPError(Exception):
    """Fake httpx-like HTTP error with a response attribute"""

    def __init__(self, status_code: int, data: dict = None):
        super().__init__(f"HTTP {status_code}")
        self.response = FakeResponse(status_code, data)


def test_parse_401_as_invalid_api_key():
    error = FakeHTTPError(401, {"error": {"message": "Unauthorized"}})
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.INVALID_API_KEY
    assert result.retryable is False


def test_parse_429_as_rate_limited():
    error = FakeHTTPError(429, {"message": "Too many requests"})
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.RATE_LIMITED
    assert result.retryable is True


def test_parse_extracts_response_from_exception():
    """Verifies the fix: parse_openrouter_error auto-extracts .response"""
    error = FakeHTTPError(402, {"message": "Insufficient credits"})
    # Don't pass response explicitly — the fix should auto-extract it
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.INSUFFICIENT_CREDITS


def test_parse_network_error():
    error = Exception("Connection refused: network error")
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.NETWORK_ERROR
    assert result.retryable is True


def test_parse_timeout():
    error = Exception("Request timeout exceeded")
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.TIMEOUT
    assert result.retryable is True


def test_parse_unknown():
    error = Exception("Something weird")
    result = parse_openrouter_error(error)
    assert result.code == OpenRouterErrorCode.UNKNOWN
    assert result.retryable is False


def test_openrouter_auto_error():
    err = OpenRouterAutoError(OpenRouterError(
        code=OpenRouterErrorCode.MODEL_NOT_FOUND,
        message="Not found",
        retryable=False,
    ))
    assert isinstance(err, Exception)
    assert err.code == OpenRouterErrorCode.MODEL_NOT_FOUND
    assert err.retryable is False


def test_is_retryable_error():
    assert is_retryable_error(OpenRouterError(
        code=OpenRouterErrorCode.RATE_LIMITED, message="", retryable=True,
    )) is True
    assert is_retryable_error(OpenRouterError(
        code=OpenRouterErrorCode.INVALID_API_KEY, message="", retryable=False,
    )) is False


def test_get_retry_delay_exponential():
    assert get_retry_delay(0) == 1.0
    assert get_retry_delay(1) == 2.0
    assert get_retry_delay(2) == 4.0


def test_get_retry_delay_capped():
    assert get_retry_delay(100) == 30.0


def test_format_error_for_display():
    display = format_error_for_display(OpenRouterError(
        code=OpenRouterErrorCode.RATE_LIMITED,
        message="Rate limited",
        retryable=True,
    ))
    assert "retryable" in display.lower()

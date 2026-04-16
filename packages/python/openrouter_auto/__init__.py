"""
OpenRouter Auto - Python SDK
Auto-configure and use any OpenRouter model with zero setup
"""

from .sdk import OpenRouterAuto, create_openrouter_auto, StreamAccumulator, create_web_search_tool, enable_web_search
from .types import (
    OpenRouterModel,
    ModelConfig,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ModelTestResult,
    UserPreferences,
    ModelFilterOptions,
    CostEstimate,
    OpenRouterError,
    OpenRouterErrorCode,
    ParameterDefinition,
)
from .errors import (
    OpenRouterAutoError,
    parse_openrouter_error,
    is_retryable_error,
    format_error_for_display,
)
from .storage import (
    StorageAdapter,
    MemoryStorage,
    FileStorage,
    create_storage,
)
from .parameters import (
    get_model_parameters,
    validate_parameters,
    get_default_parameters,
    merge_with_defaults,
)
from .cost import (
    calculate_cost,
    estimate_tokens,
    calculate_chat_cost,
    format_cost,
    is_free_model,
    get_price_tier,
    get_best_free_model,
)

__version__ = "1.0.0"
__all__ = [
    "OpenRouterAuto",
    "create_openrouter_auto",
    "StreamAccumulator",
    "create_web_search_tool",
    "enable_web_search",
    "OpenRouterModel",
    "ModelConfig",
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    "ModelTestResult",
    "UserPreferences",
    "ModelFilterOptions",
    "CostEstimate",
    "OpenRouterError",
    "OpenRouterErrorCode",
    "ParameterDefinition",
    "OpenRouterAutoError",
    "parse_openrouter_error",
    "is_retryable_error",
    "format_error_for_display",
    "StorageAdapter",
    "MemoryStorage",
    "FileStorage",
    "create_storage",
    "get_model_parameters",
    "validate_parameters",
    "get_default_parameters",
    "merge_with_defaults",
    "calculate_cost",
    "estimate_tokens",
    "calculate_chat_cost",
    "format_cost",
    "is_free_model",
    "get_price_tier",
    "get_best_free_model",
]

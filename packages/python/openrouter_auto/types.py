"""
OpenRouter Auto - Python Types
Type definitions for OpenRouter models and API
"""

from typing import Optional, List, Dict, Any, Union, Callable, AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class OpenRouterErrorCode(str, Enum):
    """Error codes for OpenRouter API"""
    INVALID_API_KEY = "INVALID_API_KEY"
    RATE_LIMITED = "RATE_LIMITED"
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    INVALID_PARAMETERS = "INVALID_PARAMETERS"
    INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    TIMEOUT = "TIMEOUT"
    UNKNOWN = "UNKNOWN"


@dataclass
class ModelArchitecture:
    """Model architecture information"""
    modality: str
    input_modalities: List[str]
    output_modalities: List[str]
    instruct_type: Optional[str] = None
    tokenizer: Optional[str] = None


@dataclass
class ModelPricing:
    """Model pricing information"""
    prompt: str
    completion: str
    image: str
    request: str


@dataclass
class TopProvider:
    """Top provider information"""
    context_length: int
    max_completion_tokens: int
    is_moderated: bool


@dataclass
class ModelLinks:
    """Model links"""
    details: Optional[str] = None


@dataclass
class OpenRouterModel:
    """Full model object from OpenRouter API"""
    id: str
    name: str
    context_length: int
    created: int
    architecture: ModelArchitecture
    pricing: ModelPricing
    supported_parameters: List[str]
    top_provider: TopProvider
    description: Optional[str] = None
    links: Optional[ModelLinks] = None
    canonical_slug: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OpenRouterModel":
        """Create model from dictionary"""
        return cls(
            id=data["id"],
            name=data["name"],
            context_length=data["context_length"],
            created=data["created"],
            architecture=ModelArchitecture(
                modality=data["architecture"]["modality"],
                input_modalities=data["architecture"]["input_modalities"],
                output_modalities=data["architecture"]["output_modalities"],
                instruct_type=data["architecture"].get("instruct_type"),
                tokenizer=data["architecture"].get("tokenizer"),
            ),
            pricing=ModelPricing(
                prompt=data["pricing"].get("prompt", "0"),
                completion=data["pricing"].get("completion", "0"),
                image=data["pricing"].get("image", "0"),
                request=data["pricing"].get("request", "0"),
            ),
            supported_parameters=data.get("supported_parameters", []),
            top_provider=TopProvider(
                context_length=data["top_provider"]["context_length"],
                max_completion_tokens=data["top_provider"]["max_completion_tokens"],
                is_moderated=data["top_provider"]["is_moderated"],
            ),
            description=data.get("description"),
            links=ModelLinks(details=data.get("links", {}).get("details")) if data.get("links") else None,
            canonical_slug=data.get("canonical_slug"),
        )


@dataclass
class ParameterDefinition:
    """Parameter definition"""
    name: str
    type: str
    description: str
    default: Optional[Any] = None
    min: Optional[float] = None
    max: Optional[float] = None
    enum: Optional[List[Any]] = None
    required: bool = False


@dataclass
class ModelConfig:
    """Model configuration"""
    model_id: str
    parameters: Dict[str, Any]
    enabled: bool = True
    test_status: Optional[str] = None
    test_error: Optional[str] = None
    last_tested: Optional[datetime] = None
    added_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "model_id": self.model_id,
            "parameters": self.parameters,
            "enabled": self.enabled,
            "test_status": self.test_status,
            "test_error": self.test_error,
            "last_tested": self.last_tested.isoformat() if self.last_tested else None,
            "added_at": self.added_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelConfig":
        """Create from dictionary"""
        return cls(
            model_id=data["model_id"],
            parameters=data["parameters"],
            enabled=data.get("enabled", True),
            test_status=data.get("test_status"),
            test_error=data.get("test_error"),
            last_tested=datetime.fromisoformat(data["last_tested"]) if data.get("last_tested") else None,
            added_at=datetime.fromisoformat(data["added_at"]) if data.get("added_at") else datetime.now(),
        )


@dataclass
class UserPreferences:
    """User preferences"""
    api_key: str
    default_model: Optional[str] = None
    default_parameters: Optional[Dict[str, Any]] = None
    max_budget: Optional[float] = None
    preferred_providers: Optional[List[str]] = None
    excluded_models: Optional[List[str]] = None


@dataclass
class ChatMessage:
    """Chat message"""
    role: str  # 'system' | 'user' | 'assistant' | 'tool'
    content: Union[str, List[Dict[str, Any]], None] = None
    name: Optional[str] = None
    # Tool calling
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    # Reasoning (response only)
    reasoning: Optional[str] = None
    reasoning_content: Optional[str] = None
    reasoning_details: Optional[List[Dict[str, Any]]] = None
    refusal: Optional[str] = None
    # Web search annotations (response only)
    annotations: Optional[List[Dict[str, Any]]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        result: Dict[str, Any] = {"role": self.role}
        # content can be str, list, or None
        if self.content is not None:
            result["content"] = self.content
        else:
            result["content"] = None
        if self.name:
            result["name"] = self.name
        if self.tool_calls is not None:
            result["tool_calls"] = self.tool_calls
        if self.tool_call_id is not None:
            result["tool_call_id"] = self.tool_call_id
        return result


@dataclass
class ChatRequest:
    """Chat request"""
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    max_tokens: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    repetition_penalty: Optional[float] = None
    min_p: Optional[float] = None
    top_a: Optional[float] = None
    seed: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    stream: Optional[bool] = None
    stream_options: Optional[Dict[str, Any]] = None
    # Tool calling
    tools: Optional[List[Any]] = None
    tool_choice: Optional[Any] = None
    parallel_tool_calls: Optional[bool] = None
    # Reasoning
    reasoning: Optional[Dict[str, Any]] = None
    include: Optional[List[str]] = None
    # Response format
    response_format: Optional[Any] = None
    # Provider routing
    provider: Optional[Dict[str, Any]] = None
    models: Optional[List[str]] = None
    route: Optional[str] = None
    # Plugins (legacy)
    plugins: Optional[List[Dict[str, Any]]] = None
    # Observability / metadata
    metadata: Optional[Dict[str, str]] = None
    trace: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    user: Optional[str] = None
    # Output modalities
    modalities: Optional[List[str]] = None
    # Misc advanced
    logprobs: Optional[bool] = None
    top_logprobs: Optional[int] = None
    cache_control: Optional[Dict[str, Any]] = None
    service_tier: Optional[str] = None
    # Catch-all for forward compatibility
    extra: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        result: Dict[str, Any] = {
            "model": self.model,
            "messages": [m.to_dict() for m in self.messages],
        }

        # Add optional parameters
        optional_params = [
            "temperature", "top_p", "top_k", "max_tokens",
            "max_completion_tokens",
            "frequency_penalty", "presence_penalty", "repetition_penalty",
            "min_p", "top_a", "seed", "stop", "stream", "stream_options",
            "tools", "tool_choice", "parallel_tool_calls",
            "reasoning", "include",
            "response_format",
            "provider", "models", "route",
            "plugins",
            "metadata", "trace", "session_id", "user",
            "modalities",
            "logprobs", "top_logprobs", "cache_control", "service_tier",
        ]

        for param in optional_params:
            value = getattr(self, param, None)
            if value is not None:
                result[param] = value

        # Merge extra dict for forward compatibility
        if self.extra:
            result.update(self.extra)

        return result


@dataclass
class ChatResponse:
    """Chat response"""
    id: str
    model: str
    choices: List[Dict[str, Any]]
    usage: Optional[Dict[str, int]] = None
    created: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatResponse":
        """Create from dictionary"""
        return cls(
            id=data["id"],
            model=data["model"],
            choices=data["choices"],
            usage=data.get("usage"),
            created=data.get("created", 0),
        )


@dataclass
class ModelTestResult:
    """Model test result"""
    success: bool
    model: str
    error: Optional[str] = None
    response_time: float = 0.0
    tokens_used: Optional[int] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class OpenRouterError:
    """OpenRouter error"""
    code: OpenRouterErrorCode
    message: str
    details: Optional[Any] = None
    retryable: bool = False


@dataclass
class ModelFilterOptions:
    """Model filter options"""
    modality: Optional[str] = None
    input_modalities: Optional[List[str]] = None
    output_modalities: Optional[List[str]] = None
    max_price: Optional[float] = None
    min_context_length: Optional[int] = None
    max_context_length: Optional[int] = None
    provider: Optional[str] = None
    search: Optional[str] = None
    supported_parameters: Optional[List[str]] = None
    exclude_models: Optional[List[str]] = None
    free_only: Optional[bool] = None
    price_tier: Optional[str] = None  # 'free' | 'cheap' | 'moderate' | 'expensive'


@dataclass
class CostEstimate:
    """Cost estimate"""
    prompt_cost: float
    completion_cost: float
    reasoning_cost: float = 0.0
    total_cost: float = 0.0
    currency: str = "USD"


@dataclass
class OpenRouterEvent:
    """OpenRouter event"""
    type: str
    payload: Any
    timestamp: datetime = field(default_factory=datetime.now)


# Type aliases
StorageType = str
EventHandler = Callable[[OpenRouterEvent], None]
ErrorHandler = Callable[[OpenRouterError], None]
EventType = str


@dataclass
class OpenRouterAutoOptions:
    """SDK initialisation options"""
    api_key: str
    base_url: str = "https://openrouter.ai/api/v1"
    # Shown in OpenRouter dashboard (HTTP-Referer and X-Title headers)
    site_url: str = "https://github.com/faraz152/openrouter-auto-connect"
    site_name: str = "openrouter-auto-connect"
    storage_type: str = "memory"
    config_path: Optional[str] = None
    auto_fetch: bool = True
    fetch_interval: int = 3600
    cache_duration: int = 3600
    enable_testing: bool = True
    test_prompt: Optional[str] = None
    on_error: Optional[ErrorHandler] = None
    on_event: Optional[EventHandler] = None

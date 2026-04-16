"""
OpenRouter Auto - Core SDK
Main SDK class for auto-configuring and using OpenRouter models
"""

import asyncio
import time
from typing import Optional, List, Dict, Any, Callable, AsyncGenerator
import httpx

from .types import (
    OpenRouterAutoOptions,
    OpenRouterModel,
    ModelConfig,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    ModelTestResult,
    UserPreferences,
    ModelFilterOptions,
    CostEstimate,
    OpenRouterEvent,
    OpenRouterError,
)
from .storage import (
    StorageAdapter,
    create_storage,
    get_stored_models,
    set_stored_models,
    get_model_configs,
    set_model_config,
    remove_model_config,
    get_user_preferences,
    set_user_preferences,
    STORAGE_KEYS,
)
from .errors import parse_openrouter_error, OpenRouterAutoError
from .parameters import get_model_parameters, validate_parameters, merge_with_defaults, sanitize_parameters
from .cost import calculate_cost, estimate_tokens

# Default test prompt
DEFAULT_TEST_PROMPT = 'Say "Hello! This is a test message." and nothing else.'

# Default options
DEFAULT_OPTIONS = {
    "base_url": "https://openrouter.ai/api/v1",
    "auto_fetch": True,
    "fetch_interval": 3600,  # 1 hour
    "cache_duration": 3600,  # 1 hour
    "enable_testing": True,
    "test_prompt": DEFAULT_TEST_PROMPT,
    "storage_type": "memory",
}


class OpenRouterAuto:
    """Main SDK class for OpenRouter Auto"""

    def __init__(self, options: Dict[str, Any]):
        """Initialize the SDK"""
        self.options = {**DEFAULT_OPTIONS, **options}
        self.api_key = self.options["api_key"]

        # Initialize storage
        storage_type = self.options.get("storage_type", "memory")
        config_path = self.options.get("config_path")
        self.storage = self.options.get("storage") or create_storage(storage_type, config_path)

        # Initialize HTTP client
        site_url = self.options.get(
            "site_url", "https://github.com/faraz152/openrouter-auto-connect"
        )
        site_name = self.options.get("site_name", "openrouter-auto-connect")

        self.client = httpx.AsyncClient(
            base_url=self.options["base_url"],
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": site_url,
                "X-Title": site_name,
            },
            timeout=60.0,
        )
        # Inject auth header per-request to avoid leaking the key in client defaults
        self.client.headers["Authorization"] = f"Bearer {self.api_key}"

        # State
        self.models: List[OpenRouterModel] = []
        self.model_configs: Dict[str, ModelConfig] = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.fetch_task: Optional[asyncio.Task] = None

    # ==================== Initialization ====================

    async def initialize(self) -> None:
        """Initialize the SDK - load cached models and configs"""
        # Load cached models
        cached_models = await get_stored_models(self.storage)
        if cached_models:
            self.models = [OpenRouterModel.from_dict(m) for m in cached_models]

        # Load model configs
        configs = await get_model_configs(self.storage)
        self.model_configs = {
            k: ModelConfig.from_dict(v) if isinstance(v, dict) else v
            for k, v in configs.items()
        }

        # Fetch fresh models if needed
        last_fetch = await self.storage.get(STORAGE_KEYS["LAST_FETCH"])
        should_fetch = (
            not last_fetch or
            (time.time() - last_fetch > self.options["cache_duration"])
        )

        if should_fetch or not self.models:
            await self.fetch_models()

    # ==================== Model Fetching ====================

    async def fetch_models(self) -> List[OpenRouterModel]:
        """Fetch all models from OpenRouter API"""
        try:
            response = await self.client.get("/models")
            response.raise_for_status()
            data = response.json()

            self.models = [
                OpenRouterModel.from_dict(m) for m in data.get("data", [])
            ]

            # Cache models
            await set_stored_models(self.storage, [m.__dict__ for m in self.models])
            await self.storage.set(STORAGE_KEYS["LAST_FETCH"], int(time.time()))

            # Emit event
            self._emit("models:updated", {"count": len(self.models)})

            return self.models
        except Exception as e:
            error = parse_openrouter_error(e)
            self._handle_error(error)
            raise OpenRouterAutoError(error)

    def get_models(self) -> List[OpenRouterModel]:
        """Get all cached models"""
        return self.models.copy()

    def get_model(self, model_id: str) -> Optional[OpenRouterModel]:
        """Get a specific model by ID"""
        for model in self.models:
            if model.id == model_id:
                return model
        return None

    def filter_models(self, options: ModelFilterOptions = None) -> List[OpenRouterModel]:
        """Filter models based on criteria"""
        options = options or ModelFilterOptions()
        filtered = []

        for model in self.models:
            # Modality filter
            if options.modality and model.architecture.modality != options.modality:
                continue

            # Input modalities filter
            if options.input_modalities:
                if not all(m in model.architecture.input_modalities for m in options.input_modalities):
                    continue

            # Output modalities filter
            if options.output_modalities:
                if not all(m in model.architecture.output_modalities for m in options.output_modalities):
                    continue

            # Max price filter
            if options.max_price is not None:
                prompt_price = float(model.pricing.prompt) if model.pricing.prompt else 0.0
                completion_price = float(model.pricing.completion) if model.pricing.completion else 0.0
                if prompt_price > options.max_price or completion_price > options.max_price:
                    continue

            # Context length filters
            if options.min_context_length and model.context_length < options.min_context_length:
                continue
            if options.max_context_length and model.context_length > options.max_context_length:
                continue

            # Provider filter
            if options.provider:
                provider = model.id.split("/")[0]
                if provider != options.provider:
                    continue

            # Search filter
            if options.search:
                search_lower = options.search.lower()
                if (
                    search_lower not in model.id.lower() and
                    search_lower not in model.name.lower() and
                    (not model.description or search_lower not in model.description.lower())
                ):
                    continue

            # Supported parameters filter
            if options.supported_parameters:
                if not all(p in (model.supported_parameters or []) for p in options.supported_parameters):
                    continue

            # Exclude models filter
            if options.exclude_models and model.id in options.exclude_models:
                continue

            # Free only filter
            if options.free_only:
                prompt_price = float(model.pricing.prompt) if model.pricing.prompt else 0.0
                completion_price = float(model.pricing.completion) if model.pricing.completion else 0.0
                if prompt_price > 0 or completion_price > 0:
                    continue

            filtered.append(model)

        return filtered

    # ==================== Model Configuration ====================

    async def add_model(
        self,
        model_id: str,
        parameters: Dict[str, Any] = None
    ) -> ModelConfig:
        """Add and configure a model"""
        parameters = parameters or {}

        model = self.get_model(model_id)
        if not model:
            raise OpenRouterAutoError(OpenRouterError(
                code="MODEL_NOT_FOUND",
                message=f"Model '{model_id}' not found. Please fetch models first.",
                retryable=False,
            ))

        # Validate parameters
        valid, errors = validate_parameters(model, parameters)
        if not valid:
            error_msg = ", ".join(f"{k}: {v}" for k, v in errors.items())
            raise OpenRouterAutoError(OpenRouterError(
                code="INVALID_PARAMETERS",
                message=f"Invalid parameters: {error_msg}",
                details={"errors": errors},
                retryable=False,
            ))

        # Create config
        config = ModelConfig(
            model_id=model_id,
            parameters=merge_with_defaults(model, parameters),
            enabled=True,
        )

        # Test the model if enabled
        if self.options.get("enable_testing", True):
            result = await self.test_model(model_id, config.parameters)
            config.test_status = "success" if result.success else "failed"
            config.test_error = result.error
            config.last_tested = result.timestamp

        # Save config
        self.model_configs[model_id] = config
        await set_model_config(self.storage, model_id, config)

        # Emit event
        self._emit("model:added", {"model_id": model_id, "config": config})

        return config

    async def remove_model(self, model_id: str) -> None:
        """Remove a model configuration"""
        if model_id in self.model_configs:
            del self.model_configs[model_id]
            await remove_model_config(self.storage, model_id)
            self._emit("model:removed", {"model_id": model_id})

    def get_model_config(self, model_id: str) -> Optional[ModelConfig]:
        """Get model configuration"""
        return self.model_configs.get(model_id)

    def get_all_model_configs(self) -> Dict[str, ModelConfig]:
        """Get all model configurations"""
        return self.model_configs.copy()

    async def update_model_parameters(
        self,
        model_id: str,
        parameters: Dict[str, Any]
    ) -> ModelConfig:
        """Update model parameters"""
        config = self.model_configs.get(model_id)
        if not config:
            raise OpenRouterAutoError(OpenRouterError(
                code="MODEL_NOT_FOUND",
                message=f"Model '{model_id}' is not configured. Add it first.",
                retryable=False,
            ))

        model = self.get_model(model_id)
        valid, errors = validate_parameters(model, parameters)
        if not valid:
            raise OpenRouterAutoError(OpenRouterError(
                code="INVALID_PARAMETERS",
                message=f"Invalid parameters: {errors}",
                details={"errors": errors},
                retryable=False,
            ))

        config.parameters.update(parameters)
        await set_model_config(self.storage, model_id, config)
        self._emit("config:changed", {"model_id": model_id, "config": config})

        return config

    # ==================== Model Testing ====================

    async def test_model(
        self,
        model_id: str,
        parameters: Dict[str, Any] = None
    ) -> ModelTestResult:
        """Test a model with a basic call"""
        parameters = parameters or {}
        start_time = time.time()

        try:
            request = ChatRequest(
                model=model_id,
                messages=[ChatMessage(
                    role="user",
                    content=self.options.get("test_prompt", DEFAULT_TEST_PROMPT)
                )],
                max_tokens=50,
                **parameters
            )

            response = await self.client.post("/chat/completions", json=request.to_dict())
            response.raise_for_status()
            data = response.json()

            response_time = time.time() - start_time

            return ModelTestResult(
                success=True,
                model=model_id,
                response_time=response_time,
                tokens_used=data.get("usage", {}).get("total_tokens"),
            )
        except Exception as e:
            response_time = time.time() - start_time
            error = parse_openrouter_error(e)

            return ModelTestResult(
                success=False,
                model=model_id,
                error=error.message,
                response_time=response_time,
            )

    async def test_all_models(self) -> List[ModelTestResult]:
        """Test all configured models"""
        results = []

        for model_id in self.model_configs:
            config = self.model_configs[model_id]
            result = await self.test_model(model_id, config.parameters)

            # Update config with test result
            config.test_status = "success" if result.success else "failed"
            config.test_error = result.error
            config.last_tested = result.timestamp
            await set_model_config(self.storage, model_id, config)

            results.append(result)
            self._emit("model:tested", {"model_id": model_id, "result": result})

        return results

    # ==================== Chat/Completion ====================

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Send a chat completion request"""
        model = self.get_model(request.model)
        if not model:
            raise OpenRouterAutoError(OpenRouterError(
                code="MODEL_NOT_FOUND",
                message=f"Model '{request.model}' not found",
                retryable=False,
            ))

        # Get model config if exists
        config = self.model_configs.get(request.model)

        # Merge parameters
        merged_params = config.parameters.copy() if config else {}
        merged_params.update(sanitize_parameters(request.to_dict()))

        # Validate parameters
        valid, errors = validate_parameters(model, merged_params)
        if not valid:
            raise OpenRouterAutoError(OpenRouterError(
                code="INVALID_PARAMETERS",
                message=f"Invalid parameters: {errors}",
                details={"errors": errors},
                retryable=False,
            ))

        try:
            response = await self.client.post("/chat/completions", json=merged_params)
            response.raise_for_status()
            return ChatResponse.from_dict(response.json())
        except Exception as e:
            error = parse_openrouter_error(e)
            self._handle_error(error)
            raise OpenRouterAutoError(error)

    async def stream_chat(self, request: ChatRequest) -> AsyncGenerator[Any, None]:
        """Stream a chat completion"""
        # Build payload dict directly to avoid double-serialisation of nested objects
        payload = {**request.to_dict(), "stream": True}

        try:
            async with self.client.stream(
                "POST",
                "/chat/completions",
                json=payload
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            import json
                            yield json.loads(data)
                        except:
                            pass
        except Exception as e:
            error = parse_openrouter_error(e)
            self._handle_error(error)
            raise OpenRouterAutoError(error)

    # ==================== Cost Calculation ====================

    def calculate_cost(
        self,
        model_id: str,
        prompt_tokens: int,
        completion_tokens: int = 0
    ) -> CostEstimate:
        """Calculate cost for a request"""
        model = self.get_model(model_id)
        if not model:
            raise ValueError(f"Model '{model_id}' not found")
        return calculate_cost(model, prompt_tokens, completion_tokens)

    # ==================== Event System ====================

    def on(self, event: str, handler: Callable) -> Callable:
        """Subscribe to events"""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)

        # Return unsubscribe function
        def unsubscribe():
            if handler in self.event_handlers.get(event, []):
                self.event_handlers[event].remove(handler)
        return unsubscribe

    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit an event"""
        event = OpenRouterEvent(type=event_type, payload=payload)

        # Call global handler if set
        on_event = self.options.get("on_event")
        if on_event:
            on_event(event)

        # Call specific handlers
        for handler in self.event_handlers.get(event_type, []):
            try:
                handler(event)
            except Exception as e:
                print(f"Error in event handler: {e}")

    def _handle_error(self, error: OpenRouterError) -> None:
        """Handle errors"""
        on_error = self.options.get("on_error")
        if on_error:
            on_error(error)
        self._emit("error", error)

    # ==================== Utility ====================

    def get_model_parameters(self, model_id: str) -> List[Any]:
        """Get parameter definitions for a model"""
        model = self.get_model(model_id)
        if not model:
            return []
        return get_model_parameters(model)

    # ==================== Cleanup ====================

    async def close(self) -> None:
        """Close the SDK and cleanup resources"""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


def create_openrouter_auto(options: Dict[str, Any]) -> OpenRouterAuto:
    """Factory function to create OpenRouterAuto instance"""
    return OpenRouterAuto(options)


# ==================== Stream Accumulator ====================

class StreamAccumulator:
    """Accumulates streaming chunks into a complete ChatResponse.
    Handles content, reasoning, and tool_calls deltas.

    Usage:
        acc = StreamAccumulator()
        async for chunk in sdk.stream_chat(request):
            acc.push(chunk)
            print(acc.content)    # text so far
            print(acc.reasoning)  # reasoning so far
        response = acc.to_response()
    """

    def __init__(self) -> None:
        self.content: str = ""
        self.reasoning: str = ""
        self.finish_reason: str = ""
        self._id: str = ""
        self._model: str = ""
        self._created: int = 0
        self._usage: Optional[Dict[str, Any]] = None
        self._tool_call_partials: Dict[int, Dict[str, str]] = {}

    def push(self, chunk: Dict[str, Any]) -> None:
        """Push a raw streaming chunk into the accumulator."""
        choices = chunk.get("choices")
        if not choices:
            # Final chunk may contain usage only
            if chunk.get("usage"):
                self._usage = chunk["usage"]
            return

        # Top-level fields
        if chunk.get("id"):
            self._id = chunk["id"]
        if chunk.get("model"):
            self._model = chunk["model"]
        if chunk.get("created"):
            self._created = chunk["created"]
        if chunk.get("usage"):
            self._usage = chunk["usage"]

        choice = choices[0]
        delta = choice.get("delta", {})

        # Finish reason
        if choice.get("finish_reason"):
            self.finish_reason = choice["finish_reason"]

        # Content
        if delta.get("content"):
            self.content += delta["content"]

        # Reasoning (MiniMax, DeepSeek, OpenAI o-series)
        if delta.get("reasoning"):
            self.reasoning += delta["reasoning"]
        if delta.get("reasoning_content"):
            self.reasoning += delta["reasoning_content"]

        # Tool calls (incremental)
        tool_calls = delta.get("tool_calls")
        if tool_calls:
            for tc in tool_calls:
                idx = tc.get("index", 0)
                if idx not in self._tool_call_partials:
                    self._tool_call_partials[idx] = {
                        "id": "", "type": "function", "name": "", "arguments": ""
                    }
                partial = self._tool_call_partials[idx]
                if tc.get("id"):
                    partial["id"] = tc["id"]
                if tc.get("type"):
                    partial["type"] = tc["type"]
                func = tc.get("function", {})
                if func.get("name"):
                    partial["name"] += func["name"]
                if func.get("arguments"):
                    partial["arguments"] += func["arguments"]

    def get_tool_calls(self) -> List[Dict[str, Any]]:
        """Build the accumulated tool calls list."""
        calls = []
        for idx in sorted(self._tool_call_partials.keys()):
            p = self._tool_call_partials[idx]
            calls.append({
                "id": p["id"],
                "type": "function",
                "function": {"name": p["name"], "arguments": p["arguments"]},
            })
        return calls

    def to_response(self) -> ChatResponse:
        """Build a ChatResponse from accumulated data."""
        tool_calls = self.get_tool_calls()
        message: Dict[str, Any] = {
            "role": "assistant",
            "content": self.content or None,
        }
        if tool_calls:
            message["tool_calls"] = tool_calls
        if self.reasoning:
            message["reasoning"] = self.reasoning

        return ChatResponse(
            id=self._id,
            model=self._model,
            choices=[{
                "index": 0,
                "message": message,
                "finish_reason": self.finish_reason,
            }],
            usage=self._usage,
            created=self._created,
        )


# ==================== Helpers ====================

def create_web_search_tool(
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a web search server tool to inject into a ChatRequest's tools list.

    Usage:
        request = ChatRequest(
            model="openai/gpt-5.2",
            messages=[...],
            tools=[create_web_search_tool({"max_results": 3})],
        )
    """
    tool: Dict[str, Any] = {"type": "openrouter:web_search"}
    if params:
        tool["parameters"] = params
    return tool


def enable_web_search(
    request: ChatRequest,
    params: Optional[Dict[str, Any]] = None,
) -> ChatRequest:
    """Return a copy of the request with web search enabled.
    If the request already has tools, the web search tool is appended.
    """
    import copy
    new_request = copy.copy(request)
    web_tool = create_web_search_tool(params)
    existing = list(request.tools or [])
    existing.append(web_tool)
    new_request.tools = existing
    return new_request

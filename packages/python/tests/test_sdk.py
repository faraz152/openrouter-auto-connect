"""SDK-level unit tests for OpenRouterAuto.
All HTTP calls are intercepted with httpx's MockTransport — no real network.
"""
import json
import pytest
import httpx

from openrouter_auto.sdk import OpenRouterAuto, create_openrouter_auto
from openrouter_auto.storage import MemoryStorage
from openrouter_auto.errors import OpenRouterAutoError
from openrouter_auto.types import (
    ChatRequest,
    ChatMessage,
    ModelFilterOptions,
    OpenRouterModel,
    ModelArchitecture,
    ModelPricing,
    TopProvider,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_model_json(
    id_="openai/gpt-4o-mini",
    name="GPT-4o Mini",
    prompt="0.00015",
    completion="0.0006",
):
    return {
        "id": id_,
        "name": name,
        "description": "A test model",
        "context_length": 128000,
        "created": 0,
        "architecture": {
            "modality": "text->text",
            "input_modalities": ["text"],
            "output_modalities": ["text"],
            "instruct_type": None,
            "tokenizer": None,
        },
        "pricing": {"prompt": prompt, "completion": completion, "image": "0", "request": "0"},
        "supported_parameters": ["temperature", "max_tokens"],
        "top_provider": {"context_length": 128000, "max_completion_tokens": 16384, "is_moderated": False},
    }


def make_chat_response_json(content="Hello from mock!"):
    return {
        "id": "chatcmpl-test",
        "model": "openai/gpt-4o-mini",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
        "created": 0,
    }


class MockTransport(httpx.AsyncBaseTransport):
    """Intercepts HTTP requests and returns canned responses."""

    def __init__(self, handlers):
        self._handlers = handlers

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        method = request.method.upper()

        if method == "GET" and path.endswith("/models"):
            handler = self._handlers.get("models")
            if callable(handler):
                return handler(request)
            models = handler if handler is not None else [make_model_json()]
            return httpx.Response(200, json={"data": models})

        if method == "POST" and path.endswith("/chat/completions"):
            handler = self._handlers.get("chat")
            if callable(handler):
                return handler(request)
            content = self._handlers.get("chat_content", "Hello from mock!")
            return httpx.Response(200, json=make_chat_response_json(content))

        raise httpx.HTTPError(f"Unhandled mock request: {method} {path}")


def make_sdk(handlers=None):
    """Create an SDK instance with a mocked HTTP transport."""
    handlers = handlers or {}
    storage = MemoryStorage()
    sdk = create_openrouter_auto({"api_key": "test-key", "storage": storage})
    sdk.client = httpx.AsyncClient(
        base_url="https://openrouter.ai/api/v1",
        transport=MockTransport(handlers),
        timeout=5.0,
    )
    return sdk


# ── fetch_models ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_models_returns_models():
    models = [make_model_json(), make_model_json(id_="anthropic/claude", name="Claude")]
    sdk = make_sdk({"models": models})

    result = await sdk.fetch_models()

    assert len(result) == 2
    assert result[0].id == "openai/gpt-4o-mini"
    assert len(sdk.get_models()) == 2


@pytest.mark.asyncio
async def test_fetch_models_emits_event():
    sdk = make_sdk({"models": [make_model_json()]})
    events = []
    sdk.on("models:updated", lambda e: events.append(e))

    await sdk.fetch_models()

    assert len(events) == 1
    assert events[0].payload["count"] == 1


@pytest.mark.asyncio
async def test_fetch_models_raises_on_http_error():
    def error_handler(request):
        return httpx.Response(401, json={"error": {"message": "Unauthorized"}})

    sdk = make_sdk({"models": error_handler})

    with pytest.raises(OpenRouterAutoError) as exc_info:
        await sdk.fetch_models()
    assert exc_info.value.code == "INVALID_API_KEY"


# ── chat ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_returns_response():
    sdk = make_sdk({"chat_content": "Paris!"})
    await sdk.fetch_models()

    response = await sdk.chat(ChatRequest(
        model="openai/gpt-4o-mini",
        messages=[ChatMessage(role="user", content="Capital of France?")],
    ))

    assert response.choices[0]["message"]["content"] == "Paris!"


@pytest.mark.asyncio
async def test_chat_raises_model_not_found():
    sdk = make_sdk()
    await sdk.fetch_models()

    with pytest.raises(OpenRouterAutoError) as exc_info:
        await sdk.chat(ChatRequest(
            model="no/such-model",
            messages=[ChatMessage(role="user", content="hi")],
        ))
    assert exc_info.value.code == "MODEL_NOT_FOUND"


@pytest.mark.asyncio
async def test_chat_raises_rate_limited():
    def rate_limit_handler(request):
        return httpx.Response(429, json={"error": {"message": "rate limit exceeded"}})

    sdk = make_sdk({"chat": rate_limit_handler})
    await sdk.fetch_models()

    with pytest.raises(OpenRouterAutoError) as exc_info:
        await sdk.chat(ChatRequest(
            model="openai/gpt-4o-mini",
            messages=[ChatMessage(role="user", content="hi")],
        ))
    assert exc_info.value.code == "RATE_LIMITED"


# ── add_model ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_model_stores_config():
    sdk = make_sdk()
    await sdk.fetch_models()

    config = await sdk.add_model("openai/gpt-4o-mini", {"temperature": 0.7}, skip_test=True)

    assert config.model_id == "openai/gpt-4o-mini"
    assert config.parameters["temperature"] == 0.7
    assert config.enabled is True


@pytest.mark.asyncio
async def test_add_model_raises_invalid_parameters():
    sdk = make_sdk()
    await sdk.fetch_models()

    with pytest.raises(OpenRouterAutoError) as exc_info:
        await sdk.add_model("openai/gpt-4o-mini", {"temperature": 5}, skip_test=True)
    assert exc_info.value.code == "INVALID_PARAMETERS"


@pytest.mark.asyncio
async def test_add_model_raises_model_not_found():
    sdk = make_sdk()
    await sdk.fetch_models()

    with pytest.raises(OpenRouterAutoError) as exc_info:
        await sdk.add_model("no/such-model", {}, skip_test=True)
    assert exc_info.value.code == "MODEL_NOT_FOUND"


# ── filter_models ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_filter_models_free_only():
    free = make_model_json(id_="vendor/free:free", prompt="0", completion="0")
    paid = make_model_json(id_="vendor/paid", prompt="0.001", completion="0.002")
    sdk = make_sdk({"models": [free, paid]})
    await sdk.fetch_models()

    result = sdk.filter_models(ModelFilterOptions(free_only=True))

    assert len(result) == 1
    assert result[0].id == "vendor/free:free"


@pytest.mark.asyncio
async def test_filter_models_search():
    models = [make_model_json(), make_model_json(id_="anthropic/claude", name="Claude")]
    sdk = make_sdk({"models": models})
    await sdk.fetch_models()

    result = sdk.filter_models(ModelFilterOptions(search="gpt"))

    assert len(result) == 1
    assert result[0].id == "openai/gpt-4o-mini"


# ── event system ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_event_subscribe_and_unsubscribe():
    sdk = make_sdk({"models": [make_model_json()]})
    events = []
    unsubscribe = sdk.on("models:updated", lambda e: events.append(e))

    await sdk.fetch_models()
    assert len(events) == 1

    unsubscribe()
    await sdk.fetch_models()
    assert len(events) == 1  # no new event after unsubscribe

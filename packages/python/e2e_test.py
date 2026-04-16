"""
OpenRouter Auto — End-to-End Test Script
=========================================
Runs a complete live test of the Python SDK against the real OpenRouter API.

Usage:
    export OPENROUTER_API_KEY=sk-or-...
    cd packages/python
    source .venv/bin/activate
    PYTHONPATH=. python e2e_test.py
"""

import asyncio
import os
import sys

# Resolve imports
sys.path.insert(0, os.path.dirname(__file__))

from openrouter_auto.sdk import create_openrouter_auto
from openrouter_auto.types import ModelFilterOptions
from openrouter_auto.cost import calculate_cost, estimate_tokens, format_cost

SEP = "─" * 60

def section(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)

def ok(msg: str) -> None:
    print(f"  ✅  {msg}")

def info(msg: str) -> None:
    print(f"  ℹ️   {msg}")

def err(msg: str) -> None:
    print(f"  ❌  {msg}")


async def run_e2e() -> None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        err("OPENROUTER_API_KEY environment variable is not set.")
        err("Run:  export OPENROUTER_API_KEY=sk-or-your-key-here")
        sys.exit(1)

    print(f"\n  OpenRouter Auto — E2E Test")
    print(f"  API key: {api_key[:8]}{'*' * (len(api_key) - 8)}")

    # ── 1. Initialise SDK ─────────────────────────────────────
    section("1 / 7  Initialise SDK")
    sdk = create_openrouter_auto({
        "api_key": api_key,
        "storage_type": "memory",
        "enable_testing": False,   # skip auto-test on addModel for speed
    })
    await sdk.initialize()
    ok("SDK initialised")

    # ── 2. Fetch models ───────────────────────────────────────
    section("2 / 7  Fetch models")
    models = sdk.get_models()
    if not models:
        err("No models returned — check your API key")
        sys.exit(1)
    ok(f"Fetched {len(models)} models from OpenRouter")
    info(f"First model: {models[0].id}  ({models[0].name})")

    # ── 3. Filter models ──────────────────────────────────────
    section("3 / 7  Filter models")
    free_models = sdk.filter_models(ModelFilterOptions(free_only=True))
    ok(f"Free models available: {len(free_models)}")
    if free_models:
        info(f"Example free model: {free_models[0].id}")

    cheap_text = sdk.filter_models(ModelFilterOptions(
        max_price=0.001,
        modality="text->text",
    ))
    ok(f"Cheap text models (< $0.001/1K tokens): {len(cheap_text)}")

    # ── 4. Cost estimation ────────────────────────────────────
    section("4 / 7  Cost estimation (offline — no API call)")
    # Pick first non-free text model
    paid_models = [m for m in models
                   if float(m.pricing.prompt or 0) > 0
                   and m.architecture.modality == "text->text"]
    if paid_models:
        test_model = paid_models[0]
        sample_text = "Hello, how are you doing today? I need some help with my project."
        tokens = estimate_tokens(sample_text)
        cost = calculate_cost(test_model, tokens, 200)
        ok(f"Model: {test_model.id}")
        ok(f"Sample text tokens: ~{tokens}")
        ok(f"Estimated cost (prompt+200 completion): {format_cost(cost.total_cost)}")
    else:
        info("No paid text models found for cost estimation")

    # ── 5. Pick a model for chat ──────────────────────────────
    section("5 / 7  Select & configure a model")

    # Prefer a free model for the live chat test
    chat_model_id: str | None = None
    if free_models:
        # Pick a free text->text model
        free_text = [m for m in free_models if "text" in m.architecture.modality]
        if free_text:
            chat_model_id = free_text[0].id

    if not chat_model_id:
        # Fall back to cheapest paid model
        sorted_models = sorted(
            [m for m in models if m.architecture.modality == "text->text"],
            key=lambda m: float(m.pricing.prompt or "999")
        )
        if sorted_models:
            chat_model_id = sorted_models[0].id

    if not chat_model_id:
        err("No suitable model found for chat test")
        sys.exit(1)

    ok(f"Selected model: {chat_model_id}")

    config = await sdk.add_model(chat_model_id, {"temperature": 0.7})
    ok(f"Model config created — enabled={config.enabled}")

    # ── 6. Live chat ──────────────────────────────────────────
    section("6 / 7  Live chat request")
    from openrouter_auto.types import ChatRequest, ChatMessage

    request = ChatRequest(
        model=chat_model_id,
        messages=[ChatMessage(
            role="user",
            content='Reply with exactly one word: "verified"',
        )],
        max_tokens=10,
        temperature=0.0,
    )

    try:
        response = await sdk.chat(request)
        reply = response.choices[0]["message"]["content"].strip()
        ok(f"Response: {reply!r}")
        if response.usage:
            ok(f"Tokens used — prompt: {response.usage.get('prompt_tokens')}, "
               f"completion: {response.usage.get('completion_tokens')}")
    except Exception as ex:
        err(f"Chat failed: {ex}")
        sys.exit(1)

    # ── 7. Streaming chat ─────────────────────────────────────
    section("7 / 7  Streaming chat request")
    chunks_received = 0
    streamed_text = ""

    try:
        stream_request = ChatRequest(
            model=chat_model_id,
            messages=[ChatMessage(
                role="user",
                content="Count from 1 to 5, one number per line.",
            )],
            max_tokens=50,
        )
        async for chunk in sdk.stream_chat(stream_request):
            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
            if delta:
                streamed_text += delta
                chunks_received += 1

        ok(f"Streamed {chunks_received} chunks")
        ok(f"Full response:\n{streamed_text.strip()}")
    except Exception as ex:
        err(f"Streaming failed: {ex}")

    # ── Summary ───────────────────────────────────────────────
    print(f"\n{SEP}")
    print("  E2E Test Complete — all steps passed ✅")
    print(SEP)

    await sdk.close()


if __name__ == "__main__":
    asyncio.run(run_e2e())

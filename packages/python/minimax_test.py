"""
OpenRouter Auto — MiniMax 2.7 Model Test
==========================================
1. Search OpenRouter for minimax/minimax-01 or MiniMax models
2. Add the best matching model
3. Run a chat request
4. Run a streaming chat request

Usage:
    export OPENROUTER_API_KEY=sk-or-...
    cd packages/python
    source .venv/bin/activate
    PYTHONPATH=. python minimax_test.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from openrouter_auto.sdk import create_openrouter_auto, StreamAccumulator
from openrouter_auto.types import ChatRequest, ChatMessage

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


async def run() -> None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        err("OPENROUTER_API_KEY is not set.")
        err("Run:  export OPENROUTER_API_KEY=sk-or-your-key-here")
        sys.exit(1)

    print(f"\n  MiniMax Model Test  |  key: {'*' * (len(api_key) - 4)}{api_key[-4:]}")

    # ── 1. Initialise SDK ─────────────────────────────────────
    section("STEP 1 — Initialise SDK")
    sdk = create_openrouter_auto({
        "api_key": api_key,
        "storage_type": "memory",
        "enable_testing": False,
    })
    await sdk.initialize()
    ok("SDK initialised")

    # ── 2. Search for MiniMax models ──────────────────────────
    section("STEP 2 — Search for MiniMax models")
    all_models = sdk.get_models()
    ok(f"Total models fetched: {len(all_models)}")

    # Search for any model whose id or name contains 'minimax'
    minimax_models = [
        m for m in all_models
        if "minimax" in m.id.lower() or "minimax" in (m.name or "").lower()
    ]

    if not minimax_models:
        err("No MiniMax models found on OpenRouter.")
        err("The model may require special access. Check https://openrouter.ai/models")
        await sdk.close()
        sys.exit(1)

    print(f"\n  Found {len(minimax_models)} MiniMax model(s):\n")
    for m in minimax_models:
        prompt_price = float(m.pricing.prompt or "0")
        print(f"    • {m.id}")
        print(f"      Name      : {m.name}")
        print(f"      Context   : {m.context_length:,} tokens")
        print(f"      Prompt $/1M: ${prompt_price * 1_000_000:.4f}")
        print()

    # ── 3. Select MiniMax 2.7 (or best available) ─────────────
    section("STEP 3 — Select best MiniMax model")

    # Priority: prefer minimax-m2.7 first, then other variants
    preferred_keywords = ["m2.7", "m2-", "minimax-01", "minimax01", "m1"]
    selected = None
    for kw in preferred_keywords:
        for m in minimax_models:
            if kw in m.id.lower():
                selected = m
                break
        if selected:
            break

    # Fall back to the first minimax model found
    if not selected:
        selected = minimax_models[0]

    ok(f"Selected: {selected.id}")
    info(f"Name    : {selected.name}")
    info(f"Context : {selected.context_length:,} tokens")
    info(f"Modality: {selected.architecture.modality}")

    # ── 4. Add model with config ───────────────────────────────
    section("STEP 4 — Add model to SDK")
    config = await sdk.add_model(selected.id, {
        "temperature": 0.7,
        "max_tokens": 512,
    })
    ok(f"Model added — enabled={config.enabled}, temperature={config.parameters.get('temperature')}")

    # ── 5. Live chat request ───────────────────────────────────
    section("STEP 5 — Live chat (non-streaming)")
    chat_request = ChatRequest(
        model=selected.id,
        messages=[ChatMessage(
            role="user",
            content='Reply with exactly one word: "verified"',
        )],
        max_tokens=10,
        temperature=0.0,
    )

    try:
        response = await sdk.chat(chat_request)
        choice = response.choices[0]
        message = choice.get("message", {})
        # Some models return content in 'content', others in 'reasoning'
        reply = (
            message.get("content")
            or message.get("reasoning")
            or str(message)
        )
        reply = reply.strip() if reply else "<empty>"
        ok(f"Response : {reply!r}")
        info(f"Raw message keys: {list(message.keys())}")
        if response.usage:
            ok(
                f"Tokens   — prompt: {response.usage.get('prompt_tokens')}, "
                f"completion: {response.usage.get('completion_tokens')}"
            )
    except Exception as ex:
        err(f"Chat failed: {ex}")
        # Try to show raw response for debugging
        try:
            info(f"Raw choices: {response.choices}")
        except Exception:
            pass
        await sdk.close()
        sys.exit(1)

    # ── 6. Streaming chat with StreamAccumulator ─────────────────
    section("STEP 6 — Streaming chat (StreamAccumulator)")

    stream_request = ChatRequest(
        model=selected.id,
        messages=[ChatMessage(
            role="user",
            content="Count from 1 to 5, one number per line.",
        )],
        max_tokens=60,
    )

    try:
        acc = StreamAccumulator()
        async for chunk in sdk.stream_chat(stream_request):
            acc.push(chunk)

        ok(f"Content  : {acc.content!r}")
        ok(f"Reasoning: {acc.reasoning[:120]!r}{'…' if len(acc.reasoning) > 120 else ''}")
        ok(f"Finish   : {acc.finish_reason}")
        ok(f"Tool calls: {len(acc.get_tool_calls())}")

        full_response = acc.to_response()
        ok(f"Reconstructed response ID: {full_response.id}")
    except Exception as ex:
        err(f"Streaming failed: {ex}")
        import traceback
        traceback.print_exc()

    # ── Summary ───────────────────────────────────────────────
    print(f"\n{SEP}")
    print("  MiniMax Test Complete ✅")
    print(SEP)

    await sdk.close()


if __name__ == "__main__":
    asyncio.run(run())

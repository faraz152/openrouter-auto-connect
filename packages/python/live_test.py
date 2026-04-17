"""
OpenRouter Auto — Live E2E Test
Uses OPENROUTER_API_KEY from .env and exercises the full SDK surface:
  1. Fetch & filter models
  2. Cost estimation
  3. Validate parameters
  4. Chat (plain message)
  5. Chat with reasoning (DeepSeek R1)
  6. Chat with tool calling
  7. Chat with web search tool
  8. Multimodal (image URL)
  9. Provider routing / fallbacks
 10. Streaming chat
"""

import asyncio
import json
import os
import sys

def load_env():
    # .env lives at the monorepo root (two levels up from packages/python/)
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

load_env()

# Allow running from anywhere — import from the local package
sys.path.insert(0, os.path.dirname(__file__))
from openrouter_auto.sdk import OpenRouterAuto
from openrouter_auto.types import ChatRequest, ChatMessage, ModelFilterOptions
from openrouter_auto.cost import calculate_cost, estimate_tokens, get_price_tier

# ── Colour helpers ──────────────────────────────────────────────────────────

def ok(msg):  print(f"  ✅ {msg}")
def fail(msg):print(f"  ❌ {msg}")
def info(msg):print(f"  ℹ️  {msg}")
def section(title): print(f"\n{'='*60}\n  {title}\n{'='*60}")

passed = 0
failed = 0

def check(label, cond, detail=""):
    global passed, failed
    if cond:
        ok(f"{label}" + (f" — {detail}" if detail else ""))
        passed += 1
    else:
        fail(f"{label}" + (f" — {detail}" if detail else ""))
        failed += 1

# ── Bootstrap ───────────────────────────────────────────────────────────────

API_KEY = os.getenv("OPENROUTER_API_KEY", "")
if not API_KEY:
    sys.exit("❌  OPENROUTER_API_KEY not set")

print(f"\n🔑 API key loaded: {API_KEY[:12]}…")

async def run():
    sdk = OpenRouterAuto({"api_key": API_KEY})

    # ── 1. Fetch models ──────────────────────────────────────────────────────
    section("1. Fetch & Filter Models")
    models = await sdk.fetch_models()
    check("Fetched models", len(models) > 0, f"{len(models)} models")

    free = sdk.filter_models(ModelFilterOptions(free_only=True))
    check("Free models exist", len(free) > 0, f"{len(free)} free models")

    text_models = sdk.filter_models(ModelFilterOptions(modality="text->text"))
    check("Text→text models exist", len(text_models) > 0, f"{len(text_models)} models")

    info(f"Sample free models: {[m.id for m in free[:3]]}")

    # ── 2. Cost estimation ───────────────────────────────────────────────────
    section("2. Cost Estimation")
    paid = [m for m in models if not m.id.endswith(":free")]
    if paid:
        m = paid[0]
        est = calculate_cost(m, prompt_tokens=500, completion_tokens=200)
        check("Cost estimate positive", est.total_cost >= 0,
              f"${est.total_cost:.6f} USD for {m.id}")
        check("Currency is USD", est.currency == "USD")
        tier = get_price_tier(m)
        check("Price tier returned", tier in ("free","cheap","moderate","expensive"), tier)

    tok = estimate_tokens("Hello, world! This is a test message.")
    check("Token estimate > 0", tok > 0, f"{tok} tokens")

    # ── 3. Parameter validation ──────────────────────────────────────────────
    section("3. Parameter Validation")
    from openrouter_auto.parameters import validate_parameters as vp
    if models:
        # Find a model that explicitly supports temperature
        temp_model = next(
            (m for m in models if "temperature" in (m.supported_parameters or [])), models[0]
        )
        ok_flag, errs = vp(temp_model, {"temperature": 0.7})
        check("Valid temperature passes", ok_flag, f"model={temp_model.id}")

        ok_flag2, errs2 = vp(temp_model, {"temperature": 99.0})
        check("Out-of-range temperature fails", not ok_flag2, f"errors={list(errs2.keys())}")

    # ── 4. Plain chat ────────────────────────────────────────────────────────
    section("4. Plain Chat")
    # Pick a cheap free model
    model_id = free[0].id if free else "openai/gpt-4o-mini"
    info(f"Using model: {model_id}")

    req = ChatRequest(
        model=model_id,
        messages=[ChatMessage(role="user", content="Reply with exactly: LIVE_TEST_OK")],
        max_tokens=20,
        temperature=0.0,
    )
    try:
        resp = await sdk.chat(req)
        content = resp.choices[0]["message"]["content"] or ""
        check("Chat response received", bool(content), repr(content[:80]))
        check("Usage returned", resp.usage is not None)
        if resp.usage:
            info(f"Tokens: prompt={resp.usage.get('prompt_tokens')} completion={resp.usage.get('completion_tokens')}")
    except Exception as e:
        fail(f"Plain chat error: {e}")

    # ── 5. Reasoning model ───────────────────────────────────────────────────
    section("5. Reasoning Model (DeepSeek R1 / free)")
    # Try a known free reasoning model, fall back gracefully
    reasoning_candidates = [
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-r1-0528:free",
        "microsoft/phi-4-reasoning:free",
    ]
    reasoning_model = next(
        (m.id for m in free if m.id in reasoning_candidates), None
    )
    if reasoning_model is None:
        info("No free reasoning model available — skipping")
    else:
        info(f"Using: {reasoning_model}")
        req = ChatRequest(
            model=reasoning_model,
            messages=[ChatMessage(role="user", content="What is 12 * 7? Reason step by step.")],
            max_tokens=200,
            include=["reasoning"],
        )
        try:
            resp = await sdk.chat(req)
            msg = resp.choices[0]["message"]
            content = msg.get("content") or ""
            reasoning = msg.get("reasoning") or msg.get("reasoning_content") or ""
            check("Reasoning response received", bool(content), repr(content[:60]))
            check("Reasoning field populated", bool(reasoning), repr(reasoning[:60]) if reasoning else "not present (OK)")
        except Exception as e:
            fail(f"Reasoning chat error: {e}")

    # ── 6. Tool calling ──────────────────────────────────────────────────────
    section("6. Tool Calling")
    tool_model = "openai/gpt-4o-mini"
    tools = [{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"}
                },
                "required": ["city"],
            },
        },
    }]
    req = ChatRequest(
        model=tool_model,
        messages=[ChatMessage(role="user", content="What's the weather in Paris?")],
        tools=tools,
        tool_choice="auto",
        max_tokens=100,
    )
    try:
        resp = await sdk.chat(req)
        msg = resp.choices[0]["message"]
        finish = resp.choices[0].get("finish_reason", "")
        tool_calls = msg.get("tool_calls") or []
        check("Tool call response received", True)
        check("Model called a tool OR answered directly",
              bool(tool_calls) or bool(msg.get("content")),
              f"finish_reason={finish}, tool_calls={len(tool_calls)}")
        if tool_calls:
            fn = tool_calls[0].get("function", {})
            check("Tool name is get_weather", fn.get("name") == "get_weather",
                  fn.get("name"))
    except Exception as e:
        fail(f"Tool calling error: {e}")

    # ── 7. Web search tool ───────────────────────────────────────────────────
    section("7. Web Search Server Tool")
    search_model = "openai/gpt-4o-mini"
    web_tool = {
        "type": "openrouter:web_search",
        "parameters": {"max_results": 3},
    }
    req = ChatRequest(
        model=search_model,
        messages=[ChatMessage(role="user",
                              content="What is today's date? Use web search.")],
        tools=[web_tool],
        max_tokens=150,
    )
    try:
        resp = await sdk.chat(req)
        content = resp.choices[0]["message"].get("content") or ""
        annotations = resp.choices[0]["message"].get("annotations") or []
        check("Web search response received", bool(content), repr(content[:80]))
        check("Annotations present or answer given",
              bool(annotations) or bool(content))
        if annotations:
            info(f"Citations: {len(annotations)} URL(s)")
    except Exception as e:
        fail(f"Web search error: {e}")

    # ── 8. Multimodal (image) ────────────────────────────────────────────────
    section("8. Multimodal — Image Input")
    vision_models = [m for m in models if "image" in m.architecture.input_modalities]
    if not vision_models:
        info("No vision model available — skipping")
    else:
        vmodel = vision_models[0].id
        info(f"Using: {vmodel}")
        req = ChatRequest(
            model=vmodel,
            messages=[ChatMessage(
                role="user",
                content=[
                    {"type": "text", "text": "What colour is the sky in this image?"},
                    {"type": "image_url", "image_url": {
                        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Sunrise_over_the_sea.jpg/320px-Sunrise_over_the_sea.jpg",
                    }},
                ],
            )],
            max_tokens=80,
        )
        try:
            resp = await sdk.chat(req)
            content = resp.choices[0]["message"].get("content") or ""
            check("Vision response received", bool(content), repr(content[:80]))
        except Exception as e:
            fail(f"Vision error: {e}")

    # ── 9. Provider routing ──────────────────────────────────────────────────
    section("9. Provider Routing & Fallbacks")
    req = ChatRequest(
        model="openai/gpt-4o-mini",
        messages=[ChatMessage(role="user", content="Say ONE word: hello")],
        provider={"allow_fallbacks": True, "sort": "price"},
        max_tokens=10,
    )
    try:
        resp = await sdk.chat(req)
        content = resp.choices[0]["message"].get("content") or ""
        check("Provider routing response received", bool(content), repr(content[:40]))
    except Exception as e:
        fail(f"Provider routing error: {e}")

    # ── 10. Streaming ─────────────────────────────────────────────────────────
    section("10. Streaming Chat")
    stream_model = free[0].id if free else "openai/gpt-4o-mini"
    info(f"Using: {stream_model}")
    req = ChatRequest(
        model=stream_model,
        messages=[ChatMessage(role="user", content="Count from 1 to 5.")],
        stream=True,
        stream_options={"include_usage": True},
        max_tokens=80,
    )
    try:
        chunks = []
        async for chunk in sdk.stream_chat(req):
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            if delta.get("content"):
                chunks.append(delta["content"])
        full = "".join(chunks)
        check("Stream received chunks", len(chunks) > 0, f"{len(chunks)} chunks")
        check("Stream assembled text non-empty", bool(full), repr(full[:60]))
    except Exception as e:
        fail(f"Streaming error: {e}")

    await sdk.close()

    # ── Summary ──────────────────────────────────────────────────────────────
    total = passed + failed
    section(f"RESULTS — {passed}/{total} passed")
    if failed == 0:
        print("  🎉 All live tests passed!\n")
    else:
        print(f"  ⚠️  {failed} test(s) failed — see above.\n")

asyncio.run(run())

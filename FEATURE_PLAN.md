# OpenRouter Auto — Feature Gap Plan

> Audit date: 16 April 2026
> Status: Living document — update as each item lands

---

## 1. Reasoning / Thinking Models

**Priority: CRITICAL** — Currently NOT SUPPORTED

Reasoning models (DeepSeek R1, MiniMax M2.7, OpenAI o1/o3/o4-mini, Claude w/ extended thinking) return chain-of-thought in dedicated fields that our SDK ignores.

### What OpenRouter provides

| Field | Location | Description |
|---|---|---|
| `message.reasoning` | Non-streaming response | Full reasoning/thinking text |
| `message.reasoning_content` | Non-streaming response | Alias used by some providers |
| `message.reasoning_details` | Non-streaming response | Array of `{ type, text, format, index }` |
| `delta.reasoning` | Streaming chunk | Streamed reasoning token |
| `delta.reasoning_content` | Streaming chunk | Alias used by some providers |
| `usage.completion_tokens_details.reasoning_tokens` | Response | Count of reasoning-only tokens |
| `reasoning` | Request body | `{ effort: "low"|"medium"|"high", max_tokens?: number }` |
| `include` | Request body | Array — `["reasoning"]` to force reasoning in non-streaming response |

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | Add `reasoning`, `reasoning_content`, `reasoning_details` to `ChatMessage`; add `ReasoningConfig` interface; add to `ChatRequest`; expand `usage` type |
| core | `cost.ts` | Add `reasoningCost` to `CostEstimate`; `calculateCost()` accepts optional `reasoningTokens` |
| core | `sdk.ts` | Stream parser extracts `delta.reasoning` / `delta.reasoning_content` |
| python | `types.py` | Mirror all type changes |
| python | `cost.py` | Mirror cost changes |
| python | `sdk.py` | Stream parser extracts reasoning deltas |
| react | Components | `CostEstimator` shows reasoning token cost line |

---

## 2. Tool Calling / Function Calling

**Priority: CRITICAL** — Currently PARTIALLY SUPPORTED (request only)

Users can send `tools` + `tool_choice` in the request, but the response types don't support `tool_calls`, the `'tool'` role is missing, and there's no streaming tool-call accumulator.

### What OpenRouter provides

| Field | Location | Description |
|---|---|---|
| `tools` | Request | Array of `{ type: "function", function: { name, description, parameters } }` |
| `tool_choice` | Request | `"auto"` / `"none"` / `{ type: "function", function: { name } }` |
| `parallel_tool_calls` | Request | Boolean — enable/disable parallel calls |
| `message.tool_calls` | Response | Array of `{ id, type, function: { name, arguments } }` |
| `role: "tool"` | Follow-up message | Message with `tool_call_id` + result content |
| `delta.tool_calls` | Streaming | Partial tool call chunks |
| `finish_reason: "tool_calls"` | Response | Signals model wants tool execution |

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | Add `ToolCall`, `ToolDefinition`, `FunctionDefinition` interfaces; extend `ChatMessage` with `tool_calls`, `tool_call_id`; add `role: 'tool'`; add `parallel_tool_calls` to `ChatRequest` |
| core | `sdk.ts` | Add `accumulateToolCalls()` helper for streaming; typed finish_reason check |
| python | `types.py` | Mirror all type changes |
| python | `sdk.py` | Mirror streaming helper |

---

## 3. Web Search (Server Tools)

**Priority: HIGH** — Currently NOT SUPPORTED

OpenRouter's recommended approach is the `openrouter:web_search` server tool, which is passed in the `tools` array. The legacy `plugins` + `:online` approach is deprecated.

### What OpenRouter provides

| Field | Location | Description |
|---|---|---|
| `{ type: "openrouter:web_search", parameters? }` | Request `tools[]` | Server tool — model decides when to search |
| `parameters.engine` | Tool config | `"auto"` / `"native"` / `"exa"` / `"firecrawl"` / `"parallel"` |
| `parameters.max_results` | Tool config | 1–25 (default 5) |
| `parameters.max_total_results` | Tool config | Cap across all search calls |
| `parameters.search_context_size` | Tool config | `"low"` / `"medium"` / `"high"` |
| `parameters.allowed_domains` | Tool config | Domain allowlist |
| `parameters.excluded_domains` | Tool config | Domain blocklist |
| `parameters.user_location` | Tool config | `{ type, city?, region?, country?, timezone? }` |
| `message.annotations` | Response | Array of `{ type: "url_citation", url_citation: { url, title, content, start_index, end_index } }` |
| `plugins` (deprecated) | Request | `[{ id: "web", engine?, max_results?, ... }]` |
| `:online` suffix (deprecated) | Model ID | `"openai/gpt-5.2:online"` |

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | Add `WebSearchTool`, `WebSearchParameters`, `Annotation`, `UrlCitation` interfaces; add `annotations` to response message; add `plugins` to `ChatRequest` (legacy compat) |
| core | `sdk.ts` | Add `enableWebSearch()` helper that injects the server tool into a request |
| python | `types.py` | Mirror type changes |
| python | `sdk.py` | Mirror helper |

---

## 4. Multimodal Input (Images / Audio)

**Priority: HIGH** — Currently NOT SUPPORTED

`ChatMessage.content` is `string`-only; OpenRouter supports content arrays with `image_url` and `input_audio` blocks.

### What OpenRouter provides

```jsonc
{
  "role": "user",
  "content": [
    { "type": "text", "text": "Describe this image" },
    { "type": "image_url", "image_url": { "url": "https://...", "detail": "auto" } }
  ]
}
```

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | `ChatMessage.content` → `string \| ContentPart[]`; add `ContentPart`, `ImageUrlContent`, `TextContent` types |
| python | `types.py` | Mirror; `ChatMessage.to_dict()` handles both |

---

## 5. Provider Routing & Fallbacks

**Priority: MEDIUM** — Currently NOT SUPPORTED

### What OpenRouter provides

| Field | Location | Description |
|---|---|---|
| `provider` | Request | `{ order: [...], allow_fallbacks, require_parameters, data_collection, ... }` |
| `models` | Request | Array of model IDs for fallback routing |
| `route` | Request | `"fallback"` |

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | Add `ProviderPreferences` interface; add `provider`, `models`, `route` to `ChatRequest` |
| python | `types.py` | Mirror |

---

## 6. Advanced Request Parameters

**Priority: MEDIUM** — Currently PARTIALLY SUPPORTED

Missing parameters that OpenRouter supports:

| Parameter | Type | Description |
|---|---|---|
| `max_completion_tokens` | `number` | Replaces deprecated `max_tokens` |
| `logprobs` | `boolean` | Return log probabilities |
| `top_logprobs` | `number` | Number of top logprobs (0–20) |
| `modalities` | `string[]` | Output modalities: `["text", "image", "audio"]` |
| `cache_control` | `object` | Anthropic-style prompt caching |
| `metadata` | `Record<string, string>` | Key-value pairs for observability |
| `trace` | `object` | Trace/observability metadata |
| `service_tier` | `string` | `"auto"` / `"default"` / `"flex"` / `"priority"` / `"scale"` |
| `session_id` | `string` | Group related requests |
| `user` | `string` | Unique user identifier |

### Changes required

| Package | File | Change |
|---|---|---|
| core | `types.ts` | Add all missing fields to `ChatRequest` |
| python | `types.py` | Mirror; add to `to_dict()` optional_params list |

---

## 7. Streaming Improvements

**Priority: MEDIUM**

### Changes required

- `stream_options` support (`{ include_usage: true }`) to get `usage` in final streaming chunk
- Structured `StreamChunk` type instead of `any`
- Helper to accumulate a full `ChatResponse` from stream chunks

---

## 8. Responses API

**Priority: LOW** — OpenRouter also supports a Responses API at `/api/v1/responses`

Separate from Chat Completions. Can be a future addition.

---

## Implementation Order

| Phase | Feature | Estimated Scope |
|---|---|---|
| **Phase 1** | 1. Reasoning + 2. Tool Calling | Types + SDK + Cost — both packages |
| **Phase 2** | 3. Web Search + 4. Multimodal | Types + helpers |
| **Phase 3** | 5. Provider Routing + 6. Advanced Params | Types only (mostly) |
| **Phase 4** | 7. Streaming Improvements | SDK logic |
| **Phase 5** | 8. Responses API | New module |

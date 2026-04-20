# OpenRouter Auto — Project Summary

## Overview

OpenRouter Auto is a multi-language SDK that auto-configures and manages all 345+ [OpenRouter](https://openrouter.ai/) models — no hardcoded model IDs, no manual parameter config. Five runtimes share a single `packages/registry/` of JSON definitions so data never drifts between languages.

| SDK | Language | Entry Point | Tests |
| --- | --- | --- | --- |
| `@openrouter-auto/core` | TypeScript | `packages/core/src/sdk.ts` | 52 (Jest) |
| `@openrouter-auto/react` | React | `packages/react/src/context.tsx` | — |
| `openrouter_auto` | Python | `packages/python/openrouter_auto/sdk.py` | 54 (pytest) |
| Go SDK | Go | `packages/go/client.go` | 22 (go test) |
| Rust SDK | Rust | `packages/rust/src/client.rs` | 21 (cargo test) |

**Total: 149 unit/integration tests + 18-check live E2E suite.**

---

## Architecture

```
packages/registry/  ←── single source of truth (4 JSON files)
      │
      ├── core/        (TS)     resolveJsonModule import
      ├── react/       (React)  wraps core via context
      ├── python/      (Py)     json.load() at import time
      ├── go/          (Go)     go:embed compiles into binary
      └── rust/        (Rust)   include_str! embeds at compile time
```

### Data Flow

```
OpenRouter API ──GET /models──► SDK cache ──► Storage adapter
Application   ──chat()───────► SDK ──POST──► OpenRouter API
```

### Internal Modules (1-to-1 across TS ↔ Python ↔ Go ↔ Rust)

| Module | Responsibility |
| --- | --- |
| **SDK / Client** | Public API: fetch, chat, stream, add, filter, events |
| **Types** | All shared interfaces / structs / dataclasses |
| **Errors** | HTTP → error-code mapping, messages, tips, retryable flag |
| **Parameters** | Validation, defaults, sanitization from `parameters.json` |
| **Cost** | Token estimation, cost breakdown from `cost.json` |
| **Storage** | MemoryStorage, FileStorage (+ localStorage for browser) |

### Registry Files

| File | Contents |
| --- | --- |
| `parameters.json` | 13 parameter definitions with types, ranges, defaults |
| `errors.json` | HTTP code map, error messages, tips, retryable list |
| `cost.json` | Price tier thresholds, token estimate ratio |
| `platform-params.json` | 23 always-allowed request params (bypass model validation) |

---

## Project Structure

```
openrouter-auto-connect/
├── packages/
│   ├── registry/                  # Shared JSON (consumed by all SDKs)
│   │   ├── parameters.json
│   │   ├── errors.json
│   │   ├── cost.json
│   │   └── platform-params.json
│   │
│   ├── core/                      # TypeScript SDK
│   │   ├── src/
│   │   │   ├── sdk.ts             # OpenRouterAuto class, StreamAccumulator
│   │   │   ├── types.ts           # Interfaces (chat, tools, reasoning, multimodal)
│   │   │   ├── errors.ts          # Error-code mapping
│   │   │   ├── parameters.ts      # Validation & defaults
│   │   │   ├── cost.ts            # Cost breakdown
│   │   │   ├── storage.ts         # Memory, localStorage, File adapters
│   │   │   └── index.ts           # Public exports
│   │   └── __tests__/             # 52 tests (Jest)
│   │
│   ├── react/                     # React wrapper
│   │   └── src/
│   │       ├── context.tsx         # OpenRouterProvider + useOpenRouter hook
│   │       └── components/
│   │           ├── ModelSelector.tsx
│   │           ├── ModelConfigPanel.tsx
│   │           ├── CostEstimator.tsx
│   │           └── ErrorDisplay.tsx
│   │
│   ├── python/                    # Python SDK + CLI
│   │   ├── openrouter_auto/
│   │   │   ├── sdk.py             # OpenRouterAuto class, StreamAccumulator
│   │   │   ├── types.py           # Dataclasses (mirrors TS)
│   │   │   ├── errors.py          # Error-code mapping
│   │   │   ├── parameters.py      # Validation & defaults
│   │   │   ├── cost.py            # Cost breakdown
│   │   │   ├── storage.py         # Memory, File adapters
│   │   │   └── cli.py             # CLI: setup, models, add, test, chat
│   │   ├── tests/                 # 54 tests (pytest)
│   │   └── live_test.py           # 18-check live E2E
│   │
│   ├── go/                        # Go SDK
│   │   ├── client.go              # NewClient, FetchModels, Chat, StreamChat, etc.
│   │   ├── types.go               # Go structs
│   │   ├── parameters.go          # Validation (go:embed)
│   │   ├── errors.go              # Error parsing (go:embed)
│   │   ├── cost.go                # Cost calc (go:embed)
│   │   ├── storage.go             # Memory, File adapters
│   │   └── client_test.go         # 22 tests (httptest)
│   │
│   └── rust/                      # Rust SDK
│       ├── src/
│       │   ├── client.rs          # Client, fetch_models, chat, stream_chat, etc.
│       │   ├── types.rs           # Serde structs, StreamAccumulator
│       │   ├── parameters.rs      # Validation (include_str!)
│       │   ├── errors.rs          # Error parsing (include_str!)
│       │   ├── cost.rs            # Cost calc (include_str!)
│       │   ├── storage.rs         # Memory, File adapters
│       │   └── lib.rs             # Re-exports
│       └── tests/integration.rs   # 21 tests (wiremock)
│
├── examples/
│   ├── react-basic.tsx
│   └── python-basic.py
├── README.md
├── QUICKSTART.md
└── PROJECT_SUMMARY.md
```

---

## Features

### Core Features (all 5 SDKs)

| Feature | Description |
| --- | --- |
| **Auto-Fetch Models** | Fetch all 345+ models, cache locally, auto-refresh |
| **Filter Models** | By price, provider, context length, modality, search text |
| **Parameter Validation** | Dynamic validation from `supported_parameters` + ranges from registry |
| **Model Testing** | Built-in test on add with configurable prompt |
| **Chat Completion** | Standard OpenAI-compatible chat API |
| **Streaming** | SSE streaming with `StreamAccumulator` (content + reasoning + tool calls) |
| **Reasoning Models** | `reasoning` field on request/response, captured by accumulator |
| **Tool Calling** | OpenAI-compatible function definitions, streaming tool-call assembly |
| **Web Search** | `createWebSearchTool()` / `enableWebSearch()` helpers |
| **Vision / Multimodal** | Image URL content parts for vision models |
| **Provider Routing** | Provider order, fallbacks, quantization preferences |
| **Cost Estimation** | Real-time pricing: prompt + completion + reasoning tokens |
| **Error Handling** | Typed error codes, user-friendly messages, tips, retryable flag |
| **Event System** | Subscribe/unsubscribe to SDK events (`models:updated`, `chat:success`, etc.) |
| **Storage** | Pluggable: Memory (default), File, localStorage (browser) |

### React-Specific

| Component | Purpose |
| --- | --- |
| `<OpenRouterProvider>` | Initializes SDK, owns all state |
| `<ModelSelector>` | Searchable dropdown with pricing |
| `<ModelConfigPanel>` | Parameter form + inline test |
| `<CostEstimator>` | Live cost breakdown |
| `<ErrorDisplay>` | Error display with tips from registry |

### Python CLI

| Command | Description |
| --- | --- |
| `openrouter-auto setup` | One-time API key configuration |
| `openrouter-auto models [--free]` | List models |
| `openrouter-auto add <model> [--temp N]` | Add and validate a model |
| `openrouter-auto test <model>` | Test a saved model |
| `openrouter-auto chat <model> "prompt" [--stream]` | Chat / stream |

---

## API Endpoints Used

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/v1/models` | GET | No | List all 345+ models |
| `/api/v1/chat/completions` | POST | Yes | Chat, streaming, tools, vision, web search |

---

## Advanced Request Fields

The SDK supports the full OpenRouter chat completions surface:

| Field | Type | Description |
| --- | --- | --- |
| `model` | `string` | Model ID (e.g. `openai/gpt-4o-mini`) |
| `messages` | `Message[]` | Chat messages (text, image, tool results) |
| `tools` | `Tool[]` | Function / web search tool definitions |
| `tool_choice` | `string \| object` | `"auto"`, `"none"`, or specific function |
| `reasoning` | `{ effort }` | Reasoning effort for R1-style models |
| `provider` | `object` | Provider order, fallbacks, quantization |
| `models` | `string[]` | Fallback model list |
| `route` | `string` | `"fallback"` routing strategy |
| `stream_options` | `object` | `{ include_usage: true }` for token counts in stream |
| `logprobs` | `bool` | Return log probabilities |
| `top_logprobs` | `number` | Number of top logprobs to return |
| `metadata` | `object` | Custom metadata (passed to OpenRouter) |
| `session_id` | `string` | Session tracking |
| `user` | `string` | End-user ID |

---

## Test Coverage

| SDK | Runner | Tests | Coverage |
| --- | --- | --- | --- |
| TypeScript | Jest | 52 | cost, errors, parameters, storage, SDK |
| Python | pytest | 54 | cost, errors, parameters, storage, SDK |
| Go | go test | 22 | client, models, chat, stream, filter, cost, storage, events, web search |
| Rust | cargo test | 21 | client, models, chat, stream, filter, cost, storage, events, web search |
| Live E2E | Python script | 18 | fetch, cost, validation, chat, tools, search, vision, routing, stream |

```bash
npm test                                     # TS: 52
cd packages/python && pytest tests/ -q       # Py: 54
cd packages/go && go test ./...              # Go: 22
cd packages/rust && cargo test               # Rust: 21
cd packages/python && python live_test.py    # E2E: 18 checks
```

---

## Design Principles

1. **Registry as single source of truth** — parameter definitions, error codes, cost tiers, and platform-allowed params live in `packages/registry/*.json`. Zero duplication across languages.

2. **Language parity rule** — every feature in `core` is mirrored in `python`, `go`, and `rust`. Module names and APIs stay aligned.

3. **Storage isolation in tests** — always inject `MemoryStorage`. Never rely on file system in unit tests.

4. **No direct HTTP outside SDK** — all HTTP calls go through the SDK's shared client instance.

5. **React state via context only** — components are stateless. All mutations flow through `useOpenRouter()`.

---

## License

MIT — see [LICENSE](LICENSE)

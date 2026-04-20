# OpenRouter Auto - Project Summary

## 🎯 Project Overview

**OpenRouter Auto** is a comprehensive multi-language SDK that enables developers to auto-configure and use any OpenRouter model with **zero setup**. It eliminates the need to hardcode model IDs, manually configure parameters, or maintain model lists.

### Problem Solved

| Before OpenRouter Auto  | With OpenRouter Auto                               |
| ----------------------- | -------------------------------------------------- |
| Hardcode model IDs      | Auto-fetch all 345+ models                         |
| Manual parameter config | Dynamic forms from API                             |
| No model validation     | Built-in testing before use                        |
| Static pricing info     | Real-time cost estimation (incl. reasoning tokens) |
| Basic chat only         | Streaming, reasoning, tools, vision, web search    |
| One language            | TypeScript · React · Python · Go · Rust            |
| Duplicated data files   | Single `registry/` JSON consumed by all five SDKs  |

## 📁 Project Structure

```
openrouter-auto/
├── packages/
│   ├── registry/                ← Single source of truth (shared by all SDKs)
│   │   ├── parameters.json      # Param definitions, ranges, defaults (13 params)
│   │   ├── errors.json          # HTTP code map, messages, tips, retryable list
│   │   ├── cost.json            # Price tier thresholds, token estimate ratio
│   │   └── platform-params.json # Always-allowed request params (23 entries)
│   │
│   ├── core/                    # @openrouter-auto/core — TypeScript SDK
│   │   ├── src/
│   │   │   ├── sdk.ts          # Main SDK class, StreamAccumulator
│   │   │   ├── types.ts        # All interfaces (incl. tools, reasoning, multimodal)
│   │   │   ├── errors.ts       # Error-code mapping (loads errors.json)
│   │   │   ├── storage.ts      # MemoryStorage, LocalStorageAdapter, FileStorage
│   │   │   ├── parameters.ts   # Validation, defaults (loads parameters.json)
│   │   │   ├── cost.ts         # Cost breakdown (loads cost.json)
│   │   │   └── index.ts        # Public exports
│   │   └── __tests__/          # Jest unit tests — 40 tests
│   │
│   ├── react/                   # @openrouter-auto/react — React wrapper
│   │   └── src/
│   │       ├── context.tsx     # OpenRouterProvider + useOpenRouter hook
│   │       └── components/
│   │           ├── ModelSelector.tsx      # Searchable model dropdown
│   │           ├── ModelConfigPanel.tsx   # Parameter configuration
│   │           ├── CostEstimator.tsx      # Real-time cost calc
│   │           └── ErrorDisplay.tsx       # Error display with tips
│   │
│   ├── python/                  # openrouter_auto — Python SDK
│   │   ├── openrouter_auto/
│   │   │   ├── sdk.py          # Main SDK class, StreamAccumulator
│   │   │   ├── types.py        # Dataclasses (mirrors TS)
│   │   │   ├── errors.py       # Error-code mapping (loads errors.json)
│   │   │   ├── storage.py      # MemoryStorage, FileStorage
│   │   │   ├── parameters.py   # Validation, defaults (loads parameters.json)
│   │   │   ├── cost.py         # Cost breakdown (loads cost.json)
│   │   │   └── cli.py          # CLI tool
│   │   ├── tests/              # pytest unit tests — 42 tests
│   │   ├── live_test.py        # Live E2E test (18 checks, real API)
│   │   └── live_e2e_test.py    # Extended live test
│   │
│   ├── go/                      # Go SDK — net/http + go:embed registry
│   │   ├── client.go           # NewClient, FetchModels, Chat, AddModel
│   │   ├── types.go            # Go structs matching OpenRouter API
│   │   ├── parameters.go       # Validation (go:embed parameters.json)
│   │   ├── errors.go           # Error parsing (go:embed errors.json)
│   │   ├── cost.go             # Cost calc (go:embed cost.json)
│   │   ├── storage.go          # MemoryStorage, FileStorage
│   │   └── client_test.go      # Tests — 13 tests, httptest mock
│   │
│   └── rust/                    # Rust SDK — reqwest + tokio + include_str! registry
│       ├── Cargo.toml
│       ├── src/
│       │   ├── client.rs       # Client::new, fetch_models, chat, add_model
│       │   ├── types.rs        # Serde structs
│       │   ├── parameters.rs   # Validation (include_str! parameters.json)
│       │   ├── errors.rs       # Error parsing (include_str! errors.json)
│       │   ├── cost.rs         # Cost calc (include_str! cost.json)
│       │   ├── storage.rs      # MemoryStorage, FileStorage
│       │   └── lib.rs          # Re-exports
│       └── tests/
│           └── integration.rs  # Tests — 13 tests, wiremock
│
├── examples/
│   ├── react-basic.tsx
│   └── python-basic.py
├── README.md
├── QUICKSTART.md
├── LICENSE
└── package.json
```

## ✨ Key Features Implemented

### 0. Registry — Single Source of Truth

- `packages/registry/` holds 4 JSON files consumed by **all five SDKs**
- **Zero data duplication** across languages: parameters, error codes, cost tiers, platform-allowed params
- Go embeds via `go:embed`; Rust embeds via `include_str!`; TS imports via `resolveJsonModule`; Python via `json.load()`
- Adding a new language SDK requires **zero registry changes**

### 1. Auto-Fetch Models

- Fetches all 345+ models from OpenRouter API
- Caches locally for performance
- Auto-refresh on configurable interval
- Filter by price, modality, provider, context length, etc.

### 2. Auto-Configure Parameters

- Dynamic parameter forms from `supported_parameters`
- Automatic validation with min/max ranges (from `parameters.json`)
- Default values per model
- `PLATFORM_PARAMS` whitelist bypasses model-specific validation

### 3. Model Testing

- Built-in test on model add
- Configurable test prompt
- Success/failure tracking with error reporting

### 4. Streaming with StreamAccumulator

- Typed streaming chunks (`StreamChunk`)
- `StreamAccumulator` accumulates `content`, `reasoning`, and `tool_calls` deltas
- Works across TypeScript, React, and Python
- Supports `stream_options: { include_usage: true }`

### 5. Reasoning Models (Phase 1)

- `ReasoningConfig` type + `reasoning` field on `ChatRequest`
- `StreamAccumulator` captures `delta.reasoning` and `delta.reasoning_content`
- Cost calculation includes `reasoning_tokens` component
- Tested live with MiniMax M2.7 and DeepSeek-R1

### 6. Tool Calling (Phase 1)

- `ToolDefinition`, `ToolCall`, `FunctionDefinition` types
- Request: `tools`, `tool_choice`, `parallel_tool_calls` fields
- `StreamAccumulator.getToolCalls()` reassembles incremental deltas
- Tested live: function name + arguments correctly accumulated

### 7. Web Search (Phase 2)

- `createWebSearchTool(params?)` helper — returns `{ type: "openrouter:web_search" }` descriptor
- `enableWebSearch(request, params?)` helper — returns patched request copy
- Supports engine selection, `max_results`, domain allow/block lists, user location
- `Annotation` and `UrlCitation` types for response citations

### 8. Multimodal / Vision (Phase 2)

- `ContentPart` union: `TextContentPart | ImageUrlContentPart | InputAudioContentPart`
- `ChatMessage.content` accepts `string | ContentPart[] | null`
- Tested live with Claude vision (image URL input)

### 9. Provider Routing + Advanced Params (Phase 3)

- `ProviderPreferences` type: `order`, `allow_fallbacks`, `require_parameters`, `sort`, `quantizations`, etc.
- Full `ChatRequest` coverage: `provider`, `models`, `route`, `plugins`, `metadata`, `trace`, `session_id`, `user`, `modalities`, `logprobs`, `top_logprobs`, `cache_control`, `service_tier`, `max_completion_tokens`

### 10. Streaming Improvements (Phase 4)

- `StreamChunk` typed struct (TS + Python)
- `stream_options: { include_usage: true }` for token counts in stream
- `StreamAccumulator.toResponse()` builds a complete `ChatResponse` from chunks

### 11. Go SDK

- `packages/go/` — ~400 LOC, stdlib `net/http`, zero external HTTP deps
- Registry JSON compiled into binary via `go:embed`
- `NewClient`, `FetchModels`, `Chat`, `AddModel`, `CheckModelAvailability`
- `MemoryStorage` + `FileStorage` (path-traversal protected)
- 13 tests via `httptest` mock server

### 12. Rust SDK

- `packages/rust/` — ~500 LOC, `reqwest` + `tokio` async runtime
- Registry JSON embedded at compile time via `include_str!`
- All types derive `Serialize`/`Deserialize` via serde
- `OraError` implements `std::error::Error`
- `MemoryStorage` + `FileStorage` (path-traversal protected)
- 13 tests via `wiremock` mock server

### 13. Cost Estimation

- Real-time pricing from API
- Token estimation from text
- Cost breakdown: prompt / completion / reasoning
- Price tier classification: free / cheap / moderate / expensive (from `cost.json`)

### 14. Error Handling

- Smart HTTP → error-code mapping (from `errors.json`)
- User-friendly messages + per-code tips
- Retryable flag on all error codes
- Body-level error detection (credit, rate-limit, model-not-found keywords)

### 15. Storage Options

- **Memory**: No persistence (default, all 5 SDKs)
- **localStorage**: Browser persistence (TS/React only)
- **File**: Node.js / Python / Go / Rust config file (`.openrouter-auto.json`)

### 16. React Components

- `ModelSelector`: Searchable dropdown
- `ModelConfigPanel`: Parameter configuration form
- `CostEstimator`: Real-time cost breakdown
- `ErrorDisplay`: Error display with tips

### 17. Python SDK

- Full async/await with `httpx`
- `stream_chat()` async generator
- `StreamAccumulator`, `create_web_search_tool()`, `enable_web_search()` helpers
- CLI: `openrouter-auto setup|models|add|test|chat`
- 1-to-1 API parity with TypeScript core

## 🔧 Technical Implementation

### Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              OPENROUTER-AUTO SDK                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Model      │  │  Config     │  │  Error Handling     │  │
│  │  Fetcher    │  │  Manager    │  │                     │  │
│  │             │  │             │  │  • Error codes      │  │
│  │ • Fetch     │  │ • Validate  │  │  • User messages    │  │
│  │ • Cache     │  │ • Store     │  │  • Retry logic      │  │
│  │ • Filter    │  │ • Test      │  │  • Tips             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Parameters │  │  Cost       │  │  Storage            │  │
│  │  Manager    │  │  Calculator │  │                     │  │
│  │             │  │             │  │  • Memory           │  │
│  │ • Validate  │  │ • Estimate  │  │  • localStorage     │  │
│  │ • Defaults  │  │ • Format    │  │  • File             │  │
│  │ • Merge     │  │ • Compare   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    OPENROUTER API                           │
│  • GET /api/v1/models              (fetch all models)       │
│  • POST /api/v1/chat/completions   (chat + stream + tools)  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Initialization**
   - Load cached models from storage
   - Fetch fresh models if needed
   - Load user preferences

2. **Model Selection**
   - User selects model from dropdown
   - SDK validates model exists
   - Fetches parameter definitions

3. **Configuration**
   - User sets parameters
   - SDK validates against model limits
   - Runs test if enabled
   - Saves config to storage

4. **Usage**
   - User makes chat request
   - SDK merges default + user params
   - Validates final parameters
   - Sends to OpenRouter API
   - Returns response

## 📊 OpenRouter API Integration

### Endpoints Used

| Endpoint                        | Purpose                                    | Auth |
| ------------------------------- | ------------------------------------------ | ---- |
| `GET /api/v1/models`            | List all models (345+)                     | No   |
| `POST /api/v1/chat/completions` | Chat, streaming, tools, vision, web search | Yes  |

### Model Object

```typescript
interface OpenRouterModel {
  id: string; // "anthropic/claude-3.5-sonnet"
  name: string; // "Claude 3.5 Sonnet"
  context_length: number; // 200000
  pricing: {
    prompt: string; // "0.000003"
    completion: string; // "0.000015"
  };
  supported_parameters: string[]; // ["temperature", "max_tokens", ...]
  architecture: {
    modality: string; // "text->text"
    input_modalities: string[]; // ["text", "image"]
    output_modalities: string[]; // ["text"]
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
}
```

## 🚀 Usage Examples

### TypeScript

```typescript
import { OpenRouterAuto } from "@openrouter-auto/core";

const or = new OpenRouterAuto({ apiKey: process.env.OPENROUTER_API_KEY! });
await or.initialize();

await or.addModel("anthropic/claude-3.5-sonnet", { temperature: 0.7 });
const response = await or.chat({
  model: "anthropic/claude-3.5-sonnet",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### React

```tsx
import { OpenRouterProvider, ModelSelector } from "@openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey={process.env.REACT_APP_OPENROUTER_API_KEY!}>
      <ModelSelector onChange={(id) => console.log(id)} />
    </OpenRouterProvider>
  );
}
```

### Python

```python
from openrouter_auto.sdk import OpenRouterAuto
from openrouter_auto.types import ChatRequest, ChatMessage

sdk = OpenRouterAuto({"api_key": "your-api-key"})
await sdk.fetch_models()

resp = await sdk.chat(ChatRequest(
    model="anthropic/claude-3.5-sonnet",
    messages=[ChatMessage(role="user", content="Hello!")],
))
print(resp.choices[0]["message"]["content"])
```

### Go

```go
client, _ := ora.NewClient(ora.Options{APIKey: os.Getenv("OPENROUTER_API_KEY")})
client.FetchModels()
resp, _ := client.Chat(ora.ChatRequest{
    Model:    "anthropic/claude-3.5-sonnet",
    Messages: []ora.ChatMessage{{Role: "user", Content: "Hello!"}},
})
fmt.Println(resp.Content())
```

### Rust

```rust
let client = Client::new(Options { api_key: api_key, ..Default::default() })?;
client.fetch_models().await?;
let resp = client.chat(&ChatRequest::new(
    "anthropic/claude-3.5-sonnet",
    vec![ChatMessage::new("user", "Hello!")],
)).await?;
println!("{}", resp.content());
```

### CLI

```bash
export OPENROUTER_API_KEY=your_key
openrouter-auto models --free
openrouter-auto add anthropic/claude-3.5-sonnet
openrouter-auto chat anthropic/claude-3.5-sonnet "Hello!"
```

## 📦 Package Distribution

### npm (TypeScript / React)

```json
{ "name": "@openrouter-auto/core", "version": "1.0.0" }
{ "name": "@openrouter-auto/react", "version": "1.0.0" }
```

### PyPI (Python)

```
openrouter-auto == 1.0.0
```

### Go module

```
github.com/faraz152/openrouter-auto-connect/go
```

### Rust crate

```toml
openrouter-auto = "0.1.0"
```

## � Test Coverage

| SDK        | Test runner   | Tests | What’s covered                                                        |
| ---------- | ------------- | ----- | --------------------------------------------------------------------- |
| TypeScript | Jest          | 40    | cost, errors, parameters, storage                                     |
| Python     | pytest        | 42    | cost, errors, parameters, storage                                     |
| Go         | `go test`     | 13    | client, models, chat, cost, storage, validation                       |
| Rust       | `cargo test`  | 13    | client, models, chat, cost, storage, validation                       |
| Live E2E   | manual script | 18    | fetch, cost, validation, chat, tools, search, vision, routing, stream |

## 🔮 Future Enhancements

1. **Responses API** — OpenRouter `/api/v1/responses` endpoint (stateful sessions)
2. **Type Codegen** — JSON Schema → auto-generate structs for all languages (when ≥4 SDKs)
3. **Vue.js / Svelte Components** — Add framework wrappers
4. **Batch Requests** — Send multiple requests efficiently
5. **Web Dashboard** — Standalone management UI

## 📈 Success Metrics

- **Developer Experience**: Zero config, one-line setup across 5 languages
- **Model Coverage**: All 345+ OpenRouter models (live-verified)
- **Data Parity**: Single `registry/` JSON — zero duplication across TS, Python, Go, Rust
- **Error Reduction**: Smart validation, `PLATFORM_PARAMS` whitelist, and helpful per-code tips
- **Cost Visibility**: Real-time cost estimation including reasoning tokens
- **Language Support**: TypeScript, React, Python, Go, Rust
- **Feature Coverage**: Chat, streaming, reasoning, tool calling, web search, vision, provider routing, logprobs, advanced params
- **Test Coverage**: 108 unit/integration tests + 18-check live E2E suite

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a PR

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

**Built with ❤️ for the AI community**

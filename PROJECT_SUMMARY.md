# OpenRouter Auto - Project Summary

## 🎯 Project Overview

**OpenRouter Auto** is a comprehensive SDK that enables developers to auto-configure and use any OpenRouter model with **zero setup**. It eliminates the need to hardcode model IDs, manually configure parameters, or maintain model lists.

### Problem Solved

| Before OpenRouter Auto  | With OpenRouter Auto                            |
| ----------------------- | ----------------------------------------------- |
| Hardcode model IDs      | Auto-fetch all 345+ models                      |
| Manual parameter config | Dynamic forms from API                          |
| No model validation     | Built-in testing before use                     |
| Static pricing info     | Real-time cost estimation (incl. reasoning)     |
| Basic chat only         | Streaming, reasoning, tools, vision, web search |
| Framework-specific      | Works with any stack                            |

## 📁 Project Structure

```
openrouter-auto/
├── packages/
│   ├── core/                    # TypeScript SDK
│   │   ├── src/
│   │   │   ├── sdk.ts          # Main SDK class
│   │   │   ├── types.ts        # Type definitions
│   │   │   ├── errors.ts       # Error handling
│   │   │   ├── storage.ts      # Storage adapters
│   │   │   ├── parameters.ts   # Parameter validation
│   │   │   ├── cost.ts         # Cost calculation
│   │   │   └── index.ts        # Exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── react/                   # React components
│   │   ├── src/
│   │   │   ├── context.tsx     # React context/provider
│   │   │   ├── components/
│   │   │   │   ├── ModelSelector.tsx      # Searchable model dropdown
│   │   │   │   ├── ModelConfigPanel.tsx   # Parameter configuration
│   │   │   │   ├── CostEstimator.tsx      # Real-time cost calc
│   │   │   │   └── ErrorDisplay.tsx       # Error display with tips
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── python/                  # Python SDK
│       ├── openrouter_auto/
│       │   ├── __init__.py
│       │   ├── sdk.py          # Main SDK class
│       │   ├── types.py        # Type definitions
│       │   ├── errors.py       # Error handling
│       │   ├── storage.py      # Storage adapters
│       │   ├── parameters.py   # Parameter validation
│       │   ├── cost.py         # Cost calculation
│       │   └── cli.py          # CLI tool
│       └── setup.py
│
├── examples/
│   ├── react-basic.tsx         # React example
│   └── python-basic.py         # Python example
│
├── README.md                   # Full documentation
├── QUICKSTART.md              # Quick start guide
├── LICENSE                    # MIT License
└── package.json               # Root package.json
```

## ✨ Key Features Implemented

### 1. Auto-Fetch Models

- Fetches all 300+ models from OpenRouter API
- Caches locally for performance
- Auto-refresh on configurable interval
- Filter by price, modality, provider, etc.

### 2. Auto-Configure Parameters

- Dynamic parameter forms from `supported_parameters`
- Automatic validation with min/max ranges
- Default values per model
- Type-safe parameter handling

### 3. Model Testing

- Built-in test on model add
- Configurable test prompt
- Success/failure tracking
- Error reporting

### 4. Streaming with StreamAccumulator

- Typed streaming chunks (`StreamChunk`)
- `StreamAccumulator` class: accumulates `content`, `reasoning`, and `tool_calls` deltas
- Works across all three runtimes (TS, React, Python)
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
- Supports custom parameters (e.g. `max_results`)
- `WebSearchParameters`, `WebSearchUserLocation`, `WebPlugin` types

### 8. Multimodal / Vision (Phase 2)

- `ContentPart` union type: `TextContentPart | ImageContentPart | InputAudioContentPart`
- `ChatMessage.content` accepts `string | ContentPart[] | null`
- `Annotation` and `UrlCitation` types for web-search response annotations

### 9. Provider Routing + Advanced Params (Phase 3)

- `ProviderPreferences` type: `order`, `allow_fallbacks`, `require_parameters`, etc.
- `ChatRequest` fields: `provider`, `models`, `route`, `plugins`, `metadata`, `trace`, `session_id`, `user`, `modalities`, `logprobs`, `top_logprobs`, `cache_control`, `service_tier`
- Platform-level params bypass model `supported_parameters` validation (via `PLATFORM_PARAMS` whitelist)

### 10. Cost Estimation

- Real-time pricing from API
- Token estimation from text
- Cost breakdown: prompt / completion / reasoning
- Monthly estimates

### 11. Error Handling

- Smart error code mapping
- User-friendly messages
- Retry suggestions
- Helpful tips per error type

### 13. Storage Options

- **Memory**: No persistence (default)
- **localStorage**: Browser persistence
- **File**: Node.js/Python config file

### 14. React Components

- `ModelSelector`: Searchable dropdown
- `ModelConfigPanel`: Parameter configuration
- `CostEstimator`: Real-time cost calc
- `ErrorDisplay`: Error display with tips

### 12. Python SDK

- Full async/await support
- Streaming responses via `stream_chat()` async generator
- `StreamAccumulator`, `create_web_search_tool()`, `enable_web_search()` helpers
- CLI tool: `openrouter-auto setup|models|add|test|chat`
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

### JavaScript/TypeScript

```typescript
import { OpenRouterAuto } from "openrouter-auto";

const or = new OpenRouterAuto({ apiKey: "..." });
await or.initialize();

// Add and use model
await or.addModel("anthropic/claude-3.5-sonnet", { temperature: 0.7 });
const response = await or.chat({
  model: "anthropic/claude-3.5-sonnet",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### React

```tsx
import {
  OpenRouterProvider,
  ModelSelector,
  useOpenRouter,
} from "openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey="...">
      <ModelSelector onChange={(id, model) => console.log(id)} />
    </OpenRouterProvider>
  );
}
```

### Python

```python
from openrouter_auto import create_openrouter_auto

or_auto = create_openrouter_auto({"api_key": "..."})
await or_auto.initialize()

await or_auto.add_model("anthropic/claude-3.5-sonnet")
response = await or_auto.chat({
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}],
})
```

### CLI

```bash
# Setup
openrouter-auto setup

# List models
openrouter-auto models --free

# Add model
openrouter-auto add anthropic/claude-3.5-sonnet

# Chat
openrouter-auto chat anthropic/claude-3.5-sonnet "Hello!"
```

## 📦 Package Distribution

### npm (JavaScript/TypeScript/React)

```json
{
  "name": "openrouter-auto",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

### PyPI (Python)

```python
# setup.py
name="openrouter-auto"
version="1.0.0"
```

## 🔮 Future Enhancements

1. **Responses API** — OpenRouter `/api/v1/responses` endpoint (stateful sessions)
2. **Vue.js / Svelte Components** — Add framework wrappers
3. **Batch Requests** — Send multiple requests efficiently
4. **Caching Layer** — Redis / edge caching for large deployments
5. **Web Dashboard** — Standalone management UI

## 📈 Success Metrics

- **Developer Experience**: Zero config, one-line setup
- **Model Coverage**: All 345+ OpenRouter models (live-verified)
- **Error Reduction**: Smart validation, PLATFORM_PARAMS whitelist, and helpful errors
- **Cost Visibility**: Real-time cost estimation including reasoning tokens
- **Framework Support**: JavaScript, TypeScript, React, Python
- **Feature Coverage**: Chat, streaming, reasoning, tool calling, web search, vision, provider routing, logprobs

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

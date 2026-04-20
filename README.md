# openrouter-auto-connect

**Auto-configure and use any OpenRouter model with zero setup — in TypeScript, React, Python, Go, or Rust.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Go](https://img.shields.io/badge/Go-1.21%2B-00ADD8.svg)](https://golang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

A **multi-language monorepo SDK** that automatically fetches, validates, and manages all 300+ OpenRouter models — with no hardcoded model IDs or manual parameter configuration. All five runtimes share a single `packages/registry/` of JSON definitions (parameters, errors, cost tiers) so data never drifts between languages.

---

## What is this?

| Before                  | After                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Hardcode model IDs      | Auto-fetch all 345+ models                                  |
| Manual parameter config | Dynamic validation from model capabilities                  |
| No cost preview         | Real-time cost estimation (incl. reasoning tokens)          |
| Basic chat only         | Streaming, reasoning, tools, vision, web search, multimodal |
| One language            | TypeScript · React · Python · Go · Rust                     |
| Duplicated data files   | Single `registry/` JSON consumed by all SDKs                |

---

## Project Structure

```
openrouter-auto-connect/
├── packages/
│   ├── registry/                # ← Single source of truth (shared by all SDKs)
│   │   ├── parameters.json      # Param definitions, ranges, defaults
│   │   ├── errors.json          # HTTP code map, messages, tips, retryable list
│   │   ├── cost.json            # Price tier thresholds, token estimate ratio
│   │   └── platform-params.json # Always-allowed request params
│   │
│   ├── core/                    # @openrouter-auto/core (TypeScript SDK)
│   │   ├── src/
│   │   │   ├── sdk.ts           # OpenRouterAuto class — public API
│   │   │   ├── types.ts         # All shared TypeScript interfaces
│   │   │   ├── errors.ts        # Error-code mapping (loads errors.json)
│   │   │   ├── storage.ts       # MemoryStorage, LocalStorageAdapter, FileStorage
│   │   │   ├── parameters.ts    # Validation, defaults (loads parameters.json)
│   │   │   ├── cost.ts          # Cost breakdown (loads cost.json)
│   │   │   └── index.ts         # Public exports
│   │   └── __tests__/           # Jest unit tests (40 tests)
│   │
│   ├── react/                   # @openrouter-auto/react (React wrapper)
│   │   └── src/
│   │       ├── context.tsx      # OpenRouterProvider + useOpenRouter hook
│   │       └── components/
│   │           ├── ModelSelector.tsx      # Searchable model dropdown
│   │           ├── ModelConfigPanel.tsx   # Parameter configuration form
│   │           ├── CostEstimator.tsx      # Live cost breakdown
│   │           └── ErrorDisplay.tsx       # Error display with tips
│   │
│   ├── python/                  # openrouter_auto (Python SDK)
│   │   ├── openrouter_auto/
│   │   │   ├── sdk.py           # OpenRouterAuto class (mirrors core)
│   │   │   ├── types.py         # Dataclasses mirroring TS interfaces
│   │   │   ├── errors.py        # Error-code mapping (loads errors.json)
│   │   │   ├── storage.py       # MemoryStorage, FileStorage
│   │   │   ├── parameters.py    # Validation, defaults (loads parameters.json)
│   │   │   ├── cost.py          # Cost breakdown (loads cost.json)
│   │   │   └── cli.py           # openrouter-auto CLI tool
│   │   └── tests/               # pytest unit tests (42 tests)
│   │
│   ├── go/                      # Go SDK (net/http, go:embed registry)
│   │   ├── client.go            # NewClient, FetchModels, Chat, AddModel
│   │   ├── types.go             # Go structs matching OpenRouter API
│   │   ├── parameters.go        # Validation (go:embed parameters.json)
│   │   ├── errors.go            # Error parsing (go:embed errors.json)
│   │   ├── cost.go              # Cost calc (go:embed cost.json)
│   │   ├── storage.go           # MemoryStorage, FileStorage
│   │   └── client_test.go       # Tests (13 tests, httptest mock)
│   │
│   └── rust/                    # Rust SDK (reqwest + tokio, include_str! registry)
│       ├── Cargo.toml
│       ├── src/
│       │   ├── client.rs        # Client::new, fetch_models, chat, add_model
│       │   ├── types.rs         # Serde structs
│       │   ├── parameters.rs    # Validation (include_str! parameters.json)
│       │   ├── errors.rs        # Error parsing (include_str! errors.json)
│       │   ├── cost.rs          # Cost calc (include_str! cost.json)
│       │   ├── storage.rs       # MemoryStorage, FileStorage
│       │   └── lib.rs           # Re-exports
│       └── tests/
│           └── integration.rs   # Integration tests (13 tests, wiremock)
│
├── examples/
│   ├── react-basic.tsx
│   └── python-basic.py
├── QUICKSTART.md
└── PROJECT_SUMMARY.md
```

---

## Installation

### TypeScript / React

```bash
git clone https://github.com/faraz152/openrouter-auto-connect.git
cd openrouter-auto-connect
npm install
npm run build
```

```typescript
import { OpenRouterAuto } from "./packages/core/dist";
```

### Python

```bash
cd packages/python
pip install -e ".[dev]"
```

### Go

```bash
cd packages/go
go test ./...  # verify
```

```go
import ora "github.com/faraz152/openrouter-auto-connect/go"
```

### Rust

```bash
cd packages/rust
cargo build
cargo test
```

```toml
# Cargo.toml
openrouter-auto = { path = "../openrouter-auto-connect/packages/rust" }
```

---

## Quick Start

### TypeScript

```typescript
import { OpenRouterAuto } from "@openrouter-auto/core";

const or = new OpenRouterAuto({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

await or.initialize();

// All 300+ models — auto-fetched
const models = or.getModels();
console.log(`Loaded ${models.length} models`);

// Add a model — parameters auto-validated
await or.addModel("anthropic/claude-3.5-sonnet", {
  temperature: 0.7,
  max_tokens: 1000,
});

// Chat
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
  ModelConfigPanel,
} from "@openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey={process.env.REACT_APP_OPENROUTER_API_KEY!}>
      <MyApp />
    </OpenRouterProvider>
  );
}

function MyApp() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  return (
    <div>
      <ModelSelector
        value={selectedModel}
        onChange={(modelId) => setSelectedModel(modelId)}
        showPricing={true}
      />
      {selectedModel && (
        <ModelConfigPanel
          modelId={selectedModel}
          onSave={(config) => console.log("Saved:", config)}
        />
      )}
    </div>
  );
}
```

### Python

```python
import asyncio
from openrouter_auto import create_openrouter_auto
from openrouter_auto.types import ChatRequest, ChatMessage

async def main():
    or_auto = create_openrouter_auto({
        "api_key": "your-openrouter-api-key",
    })
    await or_auto.initialize()

    models = or_auto.get_models()
    print(f"Loaded {len(models)} models")

    await or_auto.add_model(
        "anthropic/claude-3.5-sonnet",
        parameters={"temperature": 0.7, "max_tokens": 1000},
    )

    response = await or_auto.chat(ChatRequest(
        model="anthropic/claude-3.5-sonnet",
        messages=[ChatMessage(role="user", content="Hello!")],
    ))
    print(response.choices[0]["message"]["content"])

asyncio.run(main())
```

### Python CLI

```bash
openrouter-auto setup          # One-time setup (saves config to ~/.openrouter-auto/)
openrouter-auto models         # List all models
openrouter-auto models --free  # Free models only
openrouter-auto add anthropic/claude-3.5-sonnet --temperature 0.7
openrouter-auto test anthropic/claude-3.5-sonnet
openrouter-auto chat anthropic/claude-3.5-sonnet "Hello!"
```

### Go

```go
package main

import (
    "fmt"
    "log"
    ora "github.com/faraz152/openrouter-auto-connect/go"
)

func main() {
    client, err := ora.NewClient(ora.Options{APIKey: "your-openrouter-api-key"})
    if err != nil {
        log.Fatal(err)
    }

    // Fetch all 345+ models
    models, err := client.FetchModels()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Loaded %d models\n", len(models))

    // Chat
    resp, err := client.Chat(ora.ChatRequest{
        Model:    "openai/gpt-4o-mini",
        Messages: []ora.ChatMessage{{Role: "user", Content: "Hello!"}},
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(resp.Content())
}
```

### Rust

```rust
use openrouter_auto::{Client, ChatRequest, ChatMessage, Options};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new(Options {
        api_key: "your-openrouter-api-key".to_string(),
        ..Default::default()
    })?;

    // Fetch all 345+ models
    let models = client.fetch_models().await?;
    println!("Loaded {} models", models.len());

    // Chat
    let req = ChatRequest::new(
        "openai/gpt-4o-mini",
        vec![ChatMessage::new("user", "Hello!")],
    );
    let resp = client.chat(&req).await?;
    println!("{}", resp.content());

    Ok(())
}
```

---

## Key Features

### Model Fetching & Filtering

```typescript
// Filter by price, context, modality, provider
const freeModels = or.filterModels({ freeOnly: true });
const bigModels = or.filterModels({ minContextLength: 100000 });
const cheapModels = or.filterModels({ maxPrice: 0.001, provider: "openai" });
```

### Streaming with StreamAccumulator

Typed streaming chunks — content, reasoning, and tool calls accumulated automatically.

**TypeScript**

```typescript
import { OpenRouterAuto, StreamAccumulator } from "@openrouter-auto/core";

const acc = new StreamAccumulator();

for await (const chunk of or.streamChat({
  model: "openai/gpt-4.1-nano",
  messages: [{ role: "user", content: "Count to 5." }],
})) {
  acc.push(chunk);
  process.stdout.write(acc.content); // live output
}

const response = acc.toResponse(); // complete ChatResponse
console.log(acc.finishReason); // "stop"
```

**Python**

```python
from openrouter_auto import StreamAccumulator

acc = StreamAccumulator()

async for chunk in sdk.stream_chat(request):
    acc.push(chunk)
    print(acc.content, end="", flush=True)

response = acc.to_response()
print(acc.finish_reason)
```

---

### Reasoning Models

Models like MiniMax M2.7 and DeepSeek-R1 emit a `reasoning` field separately from `content`. `StreamAccumulator` captures both.

**TypeScript**

```typescript
const acc = new StreamAccumulator();

for await (const chunk of or.streamChat({
  model: "minimax/minimax-m2.7",
  messages: [{ role: "user", content: "Solve: 120km in 2h, speed?" }],
  reasoning: { effort: "high" },
})) {
  acc.push(chunk);
}

console.log("Reasoning:", acc.reasoning); // internal chain-of-thought
console.log("Answer:   ", acc.content); // final response
```

**Python**

```python
from openrouter_auto.types import ChatRequest, ChatMessage

request = ChatRequest(
    model="minimax/minimax-m2.7",
    messages=[ChatMessage(role="user", content="120km in 2h, speed?")],
    reasoning={"effort": "high"},
)

acc = StreamAccumulator()
async for chunk in sdk.stream_chat(request):
    acc.push(chunk)

print("Reasoning:", acc.reasoning)
print("Answer:   ", acc.content)
```

---

### Tool Calling

Pass standard OpenAI-compatible function definitions. `StreamAccumulator` correctly assembles incremental tool-call deltas.

**TypeScript**

```typescript
const response = await or.chat({
  model: "openai/gpt-4.1-nano",
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather for a city",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      },
    },
  ],
  tool_choice: "auto",
});

const toolCall = response.choices[0].message.tool_calls?.[0];
console.log(toolCall.function.name); // "get_weather"
console.log(toolCall.function.arguments); // '{"location":"Tokyo","unit":"celsius"}'
```

**Python** (streaming + accumulator)

```python
acc = StreamAccumulator()
async for chunk in sdk.stream_chat(request):   # request has tools=[...]
    acc.push(chunk)

tool_calls = acc.get_tool_calls()
print(tool_calls[0]["function"]["name"])       # "get_weather"
print(tool_calls[0]["function"]["arguments"])
```

---

### Web Search

Use the built-in `create_web_search_tool()` / `createWebSearchTool()` helper to add a server-side web search tool.

**TypeScript**

```typescript
import { createWebSearchTool, enableWebSearch } from "@openrouter-auto/core";

// Option A — helper that returns the tool descriptor
const request = {
  model: "openai/gpt-4.1-nano",
  messages: [{ role: "user", content: "What happened in the news today?" }],
  tools: [createWebSearchTool({ max_results: 3 })],
};

// Option B — one-liner helper that patches an existing request
const patchedRequest = enableWebSearch(request);
```

**Python**

```python
from openrouter_auto import create_web_search_tool, enable_web_search
from openrouter_auto.types import ChatRequest, ChatMessage

request = ChatRequest(
    model="openai/gpt-4.1-nano",
    messages=[ChatMessage(role="user", content="What happened in the news today?")],
)

# enable_web_search returns a copy with the tool appended
request = enable_web_search(request)

acc = StreamAccumulator()
async for chunk in sdk.stream_chat(request):
    acc.push(chunk)

print(acc.content)    # answer with live web context
```

---

### Multimodal (Vision)

Pass a `content` array with `text` and `image_url` parts to any vision-capable model.

**TypeScript**

```typescript
const response = await or.chat({
  model: "openai/gpt-4.1-mini",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image in one sentence." },
        {
          type: "image_url",
          image_url: { url: "https://example.com/image.png" },
        },
      ],
    },
  ],
  max_tokens: 100,
});
```

**Python**

```python
from openrouter_auto.types import ChatMessage

message = ChatMessage(
    role="user",
    content=[
        {"type": "text", "text": "Describe this image in one sentence."},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
    ]
)
```

---

### Provider Routing & Model Fallback

Control which provider handles the request and define fallback model lists.

**TypeScript**

```typescript
const response = await or.chat({
  model: "openai/gpt-4.1-nano",
  messages: [{ role: "user", content: "Hello!" }],
  provider: {
    order: ["OpenAI", "Azure"],
    allow_fallbacks: true,
  },
  models: ["openai/gpt-4.1-nano", "openai/gpt-4.1-mini"],
  route: "fallback",
});

console.log(response.model); // whichever model was actually used
```

**Python**

```python
request = ChatRequest(
    model="openai/gpt-4.1-nano",
    messages=[ChatMessage(role="user", content="Hello!")],
    provider={"order": ["OpenAI"], "allow_fallbacks": True},
    models=["openai/gpt-4.1-nano", "openai/gpt-4.1-mini"],
    route="fallback",
)
```

---

### Advanced Parameters

#### Logprobs

```typescript
const response = await or.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Say hi." }],
  logprobs: true,
  top_logprobs: 5,
});
console.log(response.choices[0].logprobs);
```

#### Metadata & Session Tracking

```typescript
await or.chat({
  model: "openai/gpt-4.1-nano",
  messages: [...],
  metadata: { "x-app": "my-app", "x-user-id": "u42" },
  session_id: "session-001",
  user: "user-42",
});
```

#### Stream Options (usage in stream)

```typescript
const acc = new StreamAccumulator();

for await (const chunk of or.streamChat({
  model: "openai/gpt-4.1-nano",
  messages: [...],
  stream_options: { include_usage: true },
})) {
  acc.push(chunk);
}

console.log(acc.toResponse().usage); // token counts available in stream
```

---

### Cost Estimation

```typescript
const cost = or.calculateCost("minimax/minimax-m2.7", 1000, 500, 300);
//                                                            ^    ^    ^
//                                                 prompt  comp  reasoning tokens
console.log(`Total: $${cost.totalCost}`);
console.log(`Reasoning portion: $${cost.reasoningCost}`);
```

**Python**

```python
from openrouter_auto.cost import calculate_cost

cost = calculate_cost(model, prompt_tokens=1000, completion_tokens=500, reasoning_tokens=300)
print(f"Total: ${cost.total_cost:.6f}")
print(f"Reasoning: ${cost.reasoning_cost:.6f}")
```

---

### Storage Options

```typescript
// Memory (default — no persistence)
new OpenRouterAuto({ apiKey: "...", storageType: "memory" });

// localStorage (browser)
new OpenRouterAuto({ apiKey: "...", storageType: "localStorage" });

// Config file (Node.js / Python)
new OpenRouterAuto({
  apiKey: "...",
  storageType: "file",
  configPath: "./.openrouter-auto.json",
});
```

### Error Handling

```typescript
try {
  await or.chat({ model: "bad-model", messages: [] });
} catch (error) {
  console.log(error.code); // 'MODEL_NOT_FOUND'
  console.log(error.retryable); // false
}
```

---

## Development

### Build & Test

```bash
# TypeScript — all packages
npm run build && npm run test   # 40 tests

# Python
cd packages/python
pip install -e ".[dev]"
pytest tests/ -q                # 42 tests
mypy openrouter_auto/
black openrouter_auto/

# Go
cd packages/go
go test ./...                   # 13 tests

# Rust
cd packages/rust
cargo test                      # 13 tests
```

### Live E2E Test (Python)

Exercises all features against the real OpenRouter API:

```bash
cd packages/python
export OPENROUTER_API_KEY=your_key
python live_test.py
```

Covers: model fetch, cost estimation, parameter validation, plain chat, tool calling, web search, multimodal vision, provider routing, and streaming.

### Environment

```bash
export OPENROUTER_API_KEY=your_key_here
```

Unit tests use `MemoryStorage` and do **not** make live API calls.

---

## Architecture

```
packages/registry/  ←─ single source of truth (JSON, read by all 4 SDKs)
      │
      ├─ core/        (TS)    import json at build time (resolveJsonModule)
      ├─ python/      (Py)    json.load() at import time
      ├─ go/          (Go)    go:embed compiles JSON into binary
      └─ rust/        (Rust)  include_str! embeds at compile time

OpenRouter API ──fetch──► SDK cache ──► Storage adapter
Application   ──chat()──► SDK ──────────► OpenRouter API
```

- **Registry as single source of truth**: parameter definitions, error codes, cost tiers and platform-allowed params live in `packages/registry/*.json` — zero duplication across languages
- **Language parity rule**: every feature in `core` is mirrored in `python`, `go`, and `rust`
- **Storage isolation in tests**: always inject `MemoryStorage` — never rely on file system
- **No direct HTTP outside SDK**: all HTTP calls go through the SDK's shared client only
- **React state via context only**: components are stateless, all mutations through `useOpenRouter()`

See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for the full architecture diagram.

---

## License

MIT © [faraz152](https://github.com/faraz152)

### JavaScript/TypeScript

```typescript
import { OpenRouterAuto } from "openrouter-auto";

// Initialize with just your API key
const or = new OpenRouterAuto({
  apiKey: "your-openrouter-api-key",
});

await or.initialize();

// Get all models (auto-fetched!)
const models = or.getModels();
console.log(`Loaded ${models.length} models`);

// Add a model - parameters auto-validated!
await or.addModel("anthropic/claude-3.5-sonnet", {
  temperature: 0.7,
  max_tokens: 1000,
});

// Use the model - no configuration needed!
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
  ModelConfigPanel,
  useOpenRouter,
} from "openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey="your-openrouter-api-key">
      <MyApp />
    </OpenRouterProvider>
  );
}

function MyApp() {
  const { addModel } = useOpenRouter();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  return (
    <div>
      {/* Auto-fetches all models */}
      <ModelSelector
        value={selectedModel}
        onChange={(modelId, model) => {
          setSelectedModel(modelId);
          console.log("Selected:", model.name);
        }}
      />

      {/* Configure selected model */}
      {selectedModel && (
        <ModelConfigPanel
          modelId={selectedModel}
          onSave={(config) => {
            console.log("Model configured:", config);
          }}
        />
      )}
    </div>
  );
}
```

### Python

```python
import asyncio
from openrouter_auto import OpenRouterAuto, create_openrouter_auto

async def main():
    # Initialize with just your API key
    or_auto = create_openrouter_auto({
        "api_key": "your-openrouter-api-key",
        "storage_type": "file",  # Saves config to .openrouter-auto.json
    })

    await or_auto.initialize()

    # Get all models (auto-fetched!)
    models = or_auto.get_models()
    print(f"Loaded {len(models)} models")

    # Add a model - parameters auto-validated!
    config = await or_auto.add_model(
        "anthropic/claude-3.5-sonnet",
        parameters={"temperature": 0.7, "max_tokens": 1000}
    )

    # Use the model - no configuration needed!
    response = await or_auto.chat({
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": "Hello!"}],
    })

    print(response.choices[0]["message"]["content"])

asyncio.run(main())
```

## 📚 Documentation

### Core Concepts

#### 1. Model Fetching

Models are automatically fetched from OpenRouter and cached locally:

```typescript
// Fetch all models (happens automatically on init)
await or.fetchModels();

// Get cached models
const models = or.getModels();

// Filter models
const cheapModels = or.filterModels({ maxPrice: 0.001 });
const freeModels = or.filterModels({ freeOnly: true });
```

#### 2. Model Configuration

Add models with automatic parameter validation:

```typescript
// Add model with parameters
const config = await or.addModel("anthropic/claude-3.5-sonnet", {
  temperature: 0.7,
  max_tokens: 1000,
});

// Test the model (auto-enabled)
console.log(config.testStatus); // 'success' or 'failed'

// Update parameters
await or.updateModelParameters("anthropic/claude-3.5-sonnet", {
  temperature: 0.5,
});
```

#### 3. Cost Estimation

Calculate costs before making requests:

```typescript
// Calculate cost for tokens
const cost = or.calculateCost("anthropic/claude-3.5-sonnet", 1000, 500);
console.log(cost.totalCost); // $0.000045

// Estimate from text
const text = "Hello, how are you?";
const tokens = or.estimateTokens(text); // ~6 tokens
```

#### 4. Error Handling

Smart error handling with helpful tips:

```typescript
try {
  await or.chat({ model: "invalid-model", messages: [] });
} catch (error) {
  console.log(error.code); // 'MODEL_NOT_FOUND'
  console.log(error.message); // User-friendly message
  console.log(error.retryable); // Can retry?
}
```

### React Components

#### ModelSelector

Searchable dropdown with filtering:

```tsx
<ModelSelector
  value={selectedModel}
  onChange={(modelId, model) => setSelectedModel(modelId)}
  showPricing={true}
  showContextLength={true}
  filters={{ freeOnly: true }}
/>
```

#### ModelConfigPanel

Configure model parameters with validation:

```tsx
<ModelConfigPanel
  modelId="anthropic/claude-3.5-sonnet"
  onSave={(config) => console.log("Saved:", config)}
  onTest={(result) => console.log("Test:", result.success)}
  showTestButton={true}
/>
```

#### CostEstimator

Real-time cost estimation:

```tsx
<CostEstimator
  modelId="anthropic/claude-3.5-sonnet"
  defaultPromptTokens={1000}
  defaultCompletionTokens={500}
  showTextInput={true}
/>
```

#### ErrorDisplay

Display errors with helpful tips:

```tsx
<ErrorDisplay
  error={error}
  onRetry={() => fetchModels()}
  onDismiss={() => setError(null)}
/>
```

### Storage Options

Choose how to store configurations:

```typescript
// Memory (default, no persistence)
const or = new OpenRouterAuto({
  apiKey: "...",
  storageType: "memory",
});

// localStorage (browser only)
const or = new OpenRouterAuto({
  apiKey: "...",
  storageType: "localStorage",
});

// Config file (Node.js/Python)
const or = new OpenRouterAuto({
  apiKey: "...",
  storageType: "file",
  configPath: "./.openrouter-auto.json",
});
```

### Python SDK

#### Async Usage

```python
import asyncio
from openrouter_auto import create_openrouter_auto

async def main():
    or_auto = create_openrouter_auto({
        "api_key": "your-api-key",
        "storage_type": "file",
    })

    await or_auto.initialize()

    # Stream responses
    async for chunk in or_auto.stream_chat({
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": "Hello!"}],
    }):
        print(chunk.get("choices", [{}])[0].get("delta", {}).get("content", ""), end="")

asyncio.run(main())
```

## 🔧 Configuration Options

### JavaScript/TypeScript

```typescript
interface OpenRouterAutoOptions {
  apiKey: string; // Required: OpenRouter API key
  baseUrl?: string; // Default: 'https://openrouter.ai/api/v1'
  storageType?: "memory" | "localStorage" | "file";
  configPath?: string; // For file storage
  autoFetch?: boolean; // Auto-fetch models on init
  fetchInterval?: number; // Auto-fetch interval (ms)
  cacheDuration?: number; // Cache duration (ms)
  enableTesting?: boolean; // Test models on add
  testPrompt?: string; // Test prompt to use
  onError?: (error) => void; // Global error handler
  onEvent?: (event) => void; // Global event handler
}
```

### Python

```python
options = {
    "api_key": "your-api-key",
    "base_url": "https://openrouter.ai/api/v1",
    "storage_type": "file",  # or "memory"
    "config_path": "./.openrouter-auto.json",
    "auto_fetch": True,
    "fetch_interval": 3600,
    "cache_duration": 3600,
    "enable_testing": True,
    "test_prompt": "Say hello",
}
```

## 📁 Project Structure

```
openrouter-auto/
├── packages/
│   ├── core/           # TypeScript SDK
│   │   ├── src/
│   │   │   ├── sdk.ts
│   │   │   ├── types.ts
│   │   │   ├── errors.ts
│   │   │   ├── storage.ts
│   │   │   ├── parameters.ts
│   │   │   └── cost.ts
│   │   └── package.json
│   ├── react/          # React components
│   │   ├── src/
│   │   │   ├── context.tsx
│   │   │   └── components/
│   │   │       ├── ModelSelector.tsx
│   │   │       ├── ModelConfigPanel.tsx
│   │   │       ├── CostEstimator.tsx
│   │   │       └── ErrorDisplay.tsx
│   │   └── package.json
│   └── python/         # Python SDK
│       ├── openrouter_auto/
│       │   ├── __init__.py
│       │   ├── sdk.py
│       │   ├── types.py
│       │   ├── errors.py
│       │   ├── storage.py
│       │   ├── parameters.py
│       │   └── cost.py
│       └── setup.py
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai/) for providing the unified AI API
- All the model providers for their amazing AI models

---

**Made with ❤️ for the AI community**

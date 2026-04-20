# OpenRouter Auto

**Use any AI model through one SDK. TypeScript · React · Python · Go · Rust.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Go](https://img.shields.io/badge/Go-1.21%2B-00ADD8.svg)](https://golang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

---

## What is OpenRouter?

[OpenRouter](https://openrouter.ai/) provides a **single API** to access models from Anthropic, OpenAI, Google, and dozens of other providers.

**Why use OpenRouter:**

- Access **hundreds of models** from major AI providers through one API
- Automatic failover and load balancing across providers
- No vendor lock-in — switch models with one line change

**Get your API key:**

1. Create an account at [openrouter.ai](https://openrouter.ai/)
2. Add credits and generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
3. Use your key with any SDK below

---

## Why OpenRouter Auto?

| Without this SDK        | With OpenRouter Auto                            |
| ----------------------- | ----------------------------------------------- |
| Hardcode model IDs      | Auto-fetch all 345+ models                      |
| Manual parameter config | Validation from model capabilities              |
| No cost preview         | Real-time cost estimation                       |
| Basic chat only         | Streaming, reasoning, tools, vision, web search |
| One language            | TypeScript · React · Python · Go · Rust         |
| Duplicated config       | Single `registry/` JSON — zero drift            |

---

## Install

### TypeScript / React

```bash
npm install @openrouter-auto/core
# or for React components:
npm install @openrouter-auto/react
```

### Python

```bash
pip install openrouter-auto
```

### Go

```go
import ora "github.com/faraz152/openrouter-auto-connect/go"
```

### Rust

```toml
[dependencies]
openrouter-auto = { git = "https://github.com/faraz152/openrouter-auto-connect", subdirectory = "packages/rust" }
```

---

## Quick Start

Every SDK follows the same three steps: **init → fetch models → chat**.

**TypeScript:**

```typescript
import { OpenRouterAuto } from "@openrouter-auto/core";

const or = new OpenRouterAuto({ apiKey: process.env.OPENROUTER_API_KEY! });
await or.initialize();

const response = await or.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);
```

**Python:**

```python
from openrouter_auto import create_openrouter_auto
from openrouter_auto.types import ChatRequest, ChatMessage

sdk = create_openrouter_auto({"api_key": "sk-or-v1-..."})
await sdk.fetch_models()

resp = await sdk.chat(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Hello!")],
))
print(resp.choices[0]["message"]["content"])
```

**Go:**

```go
client, _ := ora.NewClient(ora.Options{APIKey: os.Getenv("OPENROUTER_API_KEY")})
client.FetchModels()

resp, _ := client.Chat(ora.ChatRequest{
    Model:    "openai/gpt-4o-mini",
    Messages: []ora.ChatMessage{{Role: "user", Content: "Hello!"}},
})
fmt.Println(resp.Content())
```

**Rust:**

```rust
let client = Client::new(Options { api_key: key, ..Default::default() })?;
client.fetch_models().await?;

let resp = client.chat(&ChatRequest::new(
    "openai/gpt-4o-mini",
    vec![ChatMessage::new("user", "Hello!")],
)).await?;
println!("{}", resp.content());
```

**React:**

```tsx
import {
  OpenRouterProvider,
  ModelSelector,
  useOpenRouter,
} from "@openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey={process.env.REACT_APP_OPENROUTER_API_KEY!}>
      <Chat />
    </OpenRouterProvider>
  );
}

function Chat() {
  const { chat } = useOpenRouter();
  const [model, setModel] = useState<string | null>(null);

  return (
    <div>
      <ModelSelector value={model} onChange={setModel} />
      <button
        onClick={() =>
          chat({ model, messages: [{ role: "user", content: "Hello!" }] })
        }>
        Send
      </button>
    </div>
  );
}
```

---

## Python CLI

The Python package includes a command-line tool for quick model management.

| Command                                          | Description              |
| ------------------------------------------------ | ------------------------ |
| `openrouter-auto setup`                          | One-time API key setup   |
| `openrouter-auto models`                         | List all 345+ models     |
| `openrouter-auto models --free`                  | List free models only    |
| `openrouter-auto add <model>`                    | Add and validate a model |
| `openrouter-auto add <model> --temperature 0.7`  | Add with parameters      |
| `openrouter-auto test <model>`                   | Test a saved model       |
| `openrouter-auto chat <model> "prompt"`          | Send a chat message      |
| `openrouter-auto chat <model> "prompt" --stream` | Stream a response        |

```bash
export OPENROUTER_API_KEY=sk-or-v1-...

openrouter-auto models --free
openrouter-auto add anthropic/claude-3.5-sonnet --temperature 0.7
openrouter-auto chat anthropic/claude-3.5-sonnet "Hello!"
```

---

## SDK API Reference

All five SDKs expose the same core methods. Names follow each language's conventions.

### Core Methods

| Method         | TypeScript             | Python                  | Go                     | Rust                    | Description                              |
| -------------- | ---------------------- | ----------------------- | ---------------------- | ----------------------- | ---------------------------------------- |
| **Initialize** | `initialize()`         | `fetch_models()`        | `FetchModels()`        | `fetch_models()`        | Fetch all 345+ models from OpenRouter    |
| **Chat**       | `chat(req)`            | `chat(req)`             | `Chat(req)`            | `chat(&req)`            | Send a chat completion request           |
| **Stream**     | `streamChat(req)`      | `stream_chat(req)`      | `StreamChat(req)`      | `stream_chat(&req)`     | Stream a chat response (SSE)             |
| **Add Model**  | `addModel(id, params)` | `add_model(id, params)` | `AddModel(id, params)` | `add_model(id, params)` | Save a model config with validation      |
| **Get Models** | `getModels()`          | `get_models()`          | `GetModels()`          | `get_models()`          | Return cached model list                 |
| **Filter**     | `filterModels(opts)`   | `filter_models(opts)`   | `FilterModels(opts)`   | `filter_models(&opts)`  | Filter by price, provider, context, etc. |
| **Cost**       | `calculateCost(...)`   | `calculate_cost(...)`   | `CalculateCost(...)`   | `calculate_cost(...)`   | Estimate cost for a given token count    |
| **Events**     | `on(event, fn)`        | `on(event, fn)`         | `On(event, fn)`        | `on(event, fn)`         | Subscribe to SDK events                  |

### Filter Options

```typescript
or.filterModels({
  freeOnly: true, // free models only
  search: "claude", // search by name or ID
  provider: "anthropic", // filter by provider
  minContextLength: 100000, // minimum context window
  maxPrice: 0.001, // max price per token
});
```

### Events

| Event            | Payload             | When                          |
| ---------------- | ------------------- | ----------------------------- |
| `models:updated` | `{ count }`         | After models are fetched      |
| `model:added`    | `{ modelId }`       | After a model config is saved |
| `chat:success`   | `{ model, tokens }` | After a successful chat       |
| `chat:error`     | `{ model, error }`  | After a failed chat           |
| `error`          | `{ code, message }` | Any SDK error                 |

---

## Features

### Streaming + StreamAccumulator

All SDKs include a `StreamAccumulator` that collects streamed chunks into a final response — content, reasoning, and tool calls reassembled automatically.

```typescript
const acc = new StreamAccumulator();
for await (const chunk of or.streamChat(request)) {
  acc.push(chunk);
  process.stdout.write(acc.content);
}
const response = acc.toResponse();
```

```python
acc = StreamAccumulator()
async for chunk in sdk.stream_chat(request):
    acc.push(chunk)
    print(acc.content, end="", flush=True)
response = acc.to_response()
```

### Reasoning Models

Models like DeepSeek-R1 and MiniMax M2.7 emit a separate `reasoning` field. `StreamAccumulator` captures both.

```typescript
const resp = await or.chat({
  model: "deepseek/deepseek-r1",
  messages: [{ role: "user", content: "Solve: 120km in 2h, speed?" }],
  reasoning: { effort: "high" },
});
// resp.choices[0].message.reasoning  → chain-of-thought
// resp.choices[0].message.content    → final answer
```

### Tool Calling

Standard OpenAI-compatible function definitions. Works with streaming too.

```typescript
const resp = await or.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Weather in Tokyo?" }],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    },
  ],
  tool_choice: "auto",
});
```

### Web Search

Built-in helpers to add server-side web search to any request.

```typescript
import { enableWebSearch } from "@openrouter-auto/core";

const resp = await or.chat(
  enableWebSearch({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Latest AI news?" }],
  }),
);
```

```python
from openrouter_auto import enable_web_search

resp = await sdk.chat(enable_web_search(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Latest AI news?")],
)))
```

### Vision / Multimodal

Pass images to any vision-capable model.

```typescript
const resp = await or.chat({
  model: "openai/gpt-4.1-mini",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image." },
        {
          type: "image_url",
          image_url: { url: "https://example.com/img.png" },
        },
      ],
    },
  ],
});
```

### Provider Routing & Fallbacks

Control which provider handles requests and define fallback chains.

```typescript
const resp = await or.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
  provider: { order: ["OpenAI", "Azure"], allow_fallbacks: true },
  models: ["openai/gpt-4o-mini", "openai/gpt-4.1-nano"],
  route: "fallback",
});
```

### Cost Estimation

Real-time cost calculation including reasoning tokens.

```typescript
const cost = or.calculateCost("openai/gpt-4o-mini", 1000, 500);
console.log(`Total: $${cost.totalCost}`);
```

```python
cost = calculate_cost(model, prompt_tokens=1000, completion_tokens=500)
print(f"Total: ${cost.total_cost:.6f}")
```

### Error Handling

All SDKs map HTTP errors to typed error codes with user-friendly messages and retry guidance.

```typescript
try {
  await or.chat({ model: "bad-model", messages: [] });
} catch (err) {
  console.log(err.code); // "MODEL_NOT_FOUND"
  console.log(err.retryable); // false
}
```

| Error Code             | HTTP | Retryable | Tip                                  |
| ---------------------- | ---- | --------- | ------------------------------------ |
| `INVALID_API_KEY`      | 401  | No        | Check your key at openrouter.ai/keys |
| `RATE_LIMITED`         | 429  | Yes       | Wait a few seconds before retrying   |
| `MODEL_NOT_FOUND`      | 404  | No        | Refresh the model list               |
| `INSUFFICIENT_CREDITS` | 402  | No        | Add credits at openrouter.ai/credits |
| `PROVIDER_ERROR`       | 502  | Yes       | Try a different model                |
| `NETWORK_ERROR`        | —    | Yes       | Check your internet connection       |
| `TIMEOUT`              | 408  | Yes       | Try again or use a different model   |

---

## React Components

Four ready-to-use components. All state flows through `useOpenRouter()`.

| Component              | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `<ModelSelector />`    | Searchable model dropdown with pricing       |
| `<ModelConfigPanel />` | Parameter form with validation + test button |
| `<CostEstimator />`    | Live cost breakdown by token count           |
| `<ErrorDisplay />`     | Error message with tips and retry            |

```tsx
import {
  OpenRouterProvider,
  ModelSelector,
  ModelConfigPanel,
  CostEstimator,
  ErrorDisplay,
} from "@openrouter-auto/react";

<OpenRouterProvider apiKey="sk-or-v1-...">
  <ModelSelector value={model} onChange={setModel} showPricing />
  <ModelConfigPanel modelId={model} onSave={handleSave} showTestButton />
  <CostEstimator modelId={model} showTextInput />
  <ErrorDisplay onRetry={retry} onDismiss={dismiss} />
</OpenRouterProvider>;
```

---

## Storage Options

All SDKs support pluggable storage via `options.storage` (or `storageType`).

| Adapter          | Runtimes                  | Persistence             | Key              |
| ---------------- | ------------------------- | ----------------------- | ---------------- |
| **Memory**       | All                       | None (default)          | `"memory"`       |
| **localStorage** | Browser (TS/React)        | Per-domain              | `"localStorage"` |
| **File**         | Node.js, Python, Go, Rust | `.openrouter-auto.json` | `"file"`         |

```typescript
new OpenRouterAuto({
  apiKey: "...",
  storageType: "file",
  configPath: "./.openrouter-auto.json",
});
```

---

## Configuration

| Option          | Type       | Default                        | Description                              |
| --------------- | ---------- | ------------------------------ | ---------------------------------------- |
| `apiKey`        | `string`   | —                              | **Required.** Your OpenRouter API key    |
| `baseUrl`       | `string`   | `https://openrouter.ai/api/v1` | API base URL                             |
| `storageType`   | `string`   | `"memory"`                     | `"memory"` / `"localStorage"` / `"file"` |
| `configPath`    | `string`   | `.openrouter-auto.json`        | Path for file storage                    |
| `autoFetch`     | `bool`     | `true`                         | Auto-fetch models on init                |
| `fetchInterval` | `number`   | `3600000`                      | Model refresh interval (ms)              |
| `cacheDuration` | `number`   | `3600000`                      | Cache TTL (ms)                           |
| `enableTesting` | `bool`     | `true`                         | Test models on add                       |
| `testPrompt`    | `string`   | `"Say hello"`                  | Prompt used for model tests              |
| `onError`       | `function` | —                              | Global error callback                    |
| `onEvent`       | `function` | —                              | Global event callback                    |

---

## Project Structure

```
openrouter-auto-connect/
├── packages/
│   ├── registry/          # Single source of truth (shared by all SDKs)
│   │   ├── parameters.json
│   │   ├── errors.json
│   │   ├── cost.json
│   │   └── platform-params.json
│   ├── core/              # TypeScript SDK        (52 tests)
│   ├── react/             # React components
│   ├── python/            # Python SDK + CLI      (54 tests)
│   ├── go/                # Go SDK                (22 tests)
│   └── rust/              # Rust SDK              (21 tests)
├── examples/
│   ├── react-basic.tsx
│   └── python-basic.py
├── QUICKSTART.md
├── PROJECT_SUMMARY.md
└── README.md
```

The `registry/` folder holds parameter definitions, error codes, cost tiers, and platform-allowed params as JSON. Each SDK embeds these at build time — **zero data duplication** across languages.

---

## Build & Test

```bash
# TypeScript (all packages)
npm install && npm run build && npm test          # 52 tests

# Python
cd packages/python
pip install -e ".[dev]"
pytest tests/ -q                                  # 54 tests

# Go
cd packages/go
go test ./...                                     # 22 tests

# Rust
cd packages/rust
cargo test                                        # 21 tests

# Live E2E (real API, Python)
cd packages/python
export OPENROUTER_API_KEY=sk-or-v1-...
python live_test.py                               # 18 checks
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes — follow the [parity rule](#project-structure): features added to one SDK must be added to all
4. Add tests
5. Submit a PR

---

## License

MIT — see [LICENSE](LICENSE)

---

**[OpenRouter](https://openrouter.ai/) · [Get API Key](https://openrouter.ai/settings/keys) · [Quick Start](QUICKSTART.md) · [Full Architecture](PROJECT_SUMMARY.md)**

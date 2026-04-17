# OpenRouter Auto — Quick Start Guide

Get up and running in 5 minutes across any of the five supported runtimes.

## 🚀 Installation

### TypeScript / Node.js

```bash
git clone https://github.com/faraz152/openrouter-auto-connect.git
cd openrouter-auto-connect && npm install && npm run build
```

### Python

```bash
pip install -e "packages/python[dev]"
```

### Go

```bash
cd packages/go && go test ./...   # verify install
```

### Rust

```bash
cd packages/rust && cargo build
```

## ⚡ One-Minute Setup

### 1. Get Your API Key

1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Create a new API key
3. Copy the key — or store it in a `.env` file: `OPENROUTER_API_KEY=sk-or-v1-...`

### 2. Initialize & Chat

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
import asyncio
from openrouter_auto.sdk import OpenRouterAuto
from openrouter_auto.types import ChatRequest, ChatMessage

async def main():
    sdk = OpenRouterAuto({"api_key": "your-api-key"})
    await sdk.fetch_models()

    resp = await sdk.chat(ChatRequest(
        model="openai/gpt-4o-mini",
        messages=[ChatMessage(role="user", content="Hello!")],
    ))
    print(resp.choices[0]["message"]["content"])

asyncio.run(main())
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
let client = Client::new(Options { api_key: api_key, ..Default::default() })?;
client.fetch_models().await?;
let req = ChatRequest::new("openai/gpt-4o-mini", vec![ChatMessage::new("user", "Hello!")]);
let resp = client.chat(&req).await?;
println!("{}", resp.content());
```

## 🎨 React Quick Start

```tsx
import { OpenRouterProvider, ModelSelector, useOpenRouter } from "@openrouter-auto/react";

function App() {
  return (
    <OpenRouterProvider apiKey={process.env.REACT_APP_OPENROUTER_API_KEY!}>
      <MyComponent />
    </OpenRouterProvider>
  );
}

function MyComponent() {
  const { chat } = useOpenRouter();
  const [model, setModel] = useState<string | null>(null);

  return (
    <div>
      {/* Auto-fetches all 345+ models */}
      <ModelSelector value={model} onChange={setModel} />
      <button onClick={async () => {
        const resp = await chat({ model, messages: [{ role: "user", content: "Hello!" }] });
        console.log(resp);
      }}>Send</button>
    </div>
  );
}
```

## 🐍 Python CLI Quick Start

```bash
export OPENROUTER_API_KEY=your-api-key

# List models
openrouter-auto models
openrouter-auto models --free

# Add & test
openrouter-auto add anthropic/claude-3.5-sonnet
openrouter-auto test anthropic/claude-3.5-sonnet

# Chat & stream
openrouter-auto chat anthropic/claude-3.5-sonnet "What is the capital of France?"
openrouter-auto chat anthropic/claude-3.5-sonnet "Tell me a story" --stream
```

## 📋 Common Tasks

### Browse & Filter Models

```typescript
const models = or.getModels(); // 345+ models
const free  = or.filterModels({ freeOnly: true });
const cheap = or.filterModels({ maxPrice: 0.001, provider: "openai" });
const big   = or.filterModels({ minContextLength: 100000 });
```

```python
free  = sdk.filter_models(ModelFilterOptions(free_only=True))
cheap = sdk.filter_models(ModelFilterOptions(max_price=0.001))
```

### Reasoning Models

```python
req = ChatRequest(
    model="deepseek/deepseek-r1",   # or minimax/minimax-m2.7
    messages=[ChatMessage(role="user", content="120 km in 2 h — step by step.")],
    reasoning={"effort": "high"},
    include=["reasoning"],
)
resp = await sdk.chat(req)
msg = resp.choices[0]["message"]
print("Thinking:", msg.get("reasoning"))
print("Answer:  ", msg["content"])
```

### Tool Calling

```python
weather_tool = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
    },
}
req = ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Weather in Paris?")],
    tools=[weather_tool], tool_choice="auto",
)
resp = await sdk.chat(req)
tc = resp.choices[0]["message"]["tool_calls"][0]
print(tc["function"]["name"], tc["function"]["arguments"])
```

### Web Search

```python
from openrouter_auto import enable_web_search

req = enable_web_search(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Latest AI news?")],
))
resp = await sdk.chat(req)
print(resp.choices[0]["message"]["content"])
```

### Vision / Multimodal

```python
req = ChatRequest(
    model="openai/gpt-4.1-mini",
    messages=[ChatMessage(
        role="user",
        content=[
            {"type": "text", "text": "Describe this image."},
            {"type": "image_url", "image_url": {"url": "https://example.com/img.png"}},
        ]
    )],
)
resp = await sdk.chat(req)
print(resp.choices[0]["message"]["content"])
```

### Streaming

```python
from openrouter_auto import StreamAccumulator

acc = StreamAccumulator()
async for chunk in sdk.stream_chat(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Count to 5.")],
    stream_options={"include_usage": True},
)):
    acc.push(chunk)
    print(acc.content, end="", flush=True)

print("")  # newline
print("Finish:", acc.finish_reason)
print("Tokens:", acc.to_response().usage)
```

### Provider Routing & Fallbacks

```python
req = ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Hello!")],
    provider={"allow_fallbacks": True, "sort": "price"},
    models=["openai/gpt-4o-mini", "openai/gpt-4.1-nano"],
    route="fallback",
)
resp = await sdk.chat(req)
print("Used:", resp.model)
```

### Calculate Costs

```typescript
const cost = or.calculateCost("openai/gpt-4o-mini", 1000, 500);
console.log(`$${cost.totalCost}`);
```

```go
est := ora.CalculateCost(model, 1000, 500)
fmt.Printf("$%.6f\n", est.TotalCost)
```

### Error Handling

```typescript
try {
  await or.chat({ model: "bad-model", messages: [] });
} catch (error) {
  console.log(error.code);      // 'MODEL_NOT_FOUND'
  console.log(error.retryable); // false
}
```

```go
_, err := client.Chat(req)
if oraErr, ok := err.(*ora.ORAError); ok {
    fmt.Println(oraErr.Code)      // "MODEL_NOT_FOUND"
    fmt.Println(oraErr.Retryable) // false
}
```

## 💾 Storage Options

```typescript
// Memory (default — no persistence)
new OpenRouterAuto({ apiKey: "...", storageType: "memory" });

// localStorage (browser)
new OpenRouterAuto({ apiKey: "...", storageType: "localStorage" });

// Config file (Node.js / Python)
new OpenRouterAuto({ apiKey: "...", storageType: "file", configPath: "./.openrouter-auto.json" });
```

### Running Tests (all SDKs)

```bash
npm test                                     # TS: 40 tests
cd packages/python && pytest tests/ -q       # Py: 42 tests
cd packages/go && go test ./...              # Go: 13 tests
cd packages/rust && cargo test               # Rust: 13 tests
```

### Live E2E Test

```bash
cd packages/python
export OPENROUTER_API_KEY=your_key
python live_test.py
# Tests: fetch, cost, validation, chat, tool calling, web search, vision, routing, streaming
```

## �️ Configuration Reference

**TypeScript / React**

```typescript
new OpenRouterAuto({
  apiKey: "your-api-key",
  storageType: "file",             // "memory" | "localStorage" | "file"
  configPath: "./.openrouter-auto.json",
  autoFetch: true,
  fetchInterval: 3600000,          // ms
  cacheDuration: 3600000,
  enableTesting: true,
  onError: (err) => console.error(err),
});
```

**Python**

```python
OpenRouterAuto({
    "api_key": "your-api-key",
    "storage_type": "file",
    "config_path": "./.openrouter-auto.json",
    "auto_fetch": True,
    "fetch_interval": 3600,
    "cache_duration": 3600,
    "enable_testing": True,
})
```

**Go**

```go
ora.NewClient(ora.Options{
    APIKey:      os.Getenv("OPENROUTER_API_KEY"),
    BaseURL:     "https://openrouter.ai/api/v1",  // optional
    StorageType: "file",                           // "memory" | "file"
    ConfigPath:  ".openrouter-auto.json",
})
```

**Rust**

```rust
Client::new(Options {
    api_key:      api_key,
    base_url:     None,            // defaults to openrouter.ai
    storage_type: Some("file".to_string()),
    config_path:  Some(".openrouter-auto.json".to_string()),
    ..Default::default()
})
```

---

## 🚨 Troubleshooting

### “API key not found”

```bash
export OPENROUTER_API_KEY="your-api-key"
# or store in .env at repo root
```

### “Model not found”

```typescript
await or.fetchModels();
await or.addModel("anthropic/claude-3.5-sonnet");
```

### “Rate limited”

Wait a few seconds and retry. The SDK flags `error.retryable = true` so you can detect this in code.

### “Insufficient credits”

Visit [OpenRouter Credits](https://openrouter.ai/credits) to add more credits.

---

## 📚 Next Steps

- [Full documentation →](README.md)
- [Examples →](examples/)
- [Feature plan →](.plan/FEATURE_PLAN.md)
- [Multi-language architecture →](.plan/multi-language-expansion.md)

---

**Happy coding! 🎉**

# OpenRouter Auto — Quick Start

Get up and running in 5 minutes. Pick your language, copy the snippet, go.

---

## 1. Get Your API Key

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Go to [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
3. Create and copy your API key

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
```

---

## 2. Install

| Language | Command |
| --- | --- |
| TypeScript | `npm install @openrouter-auto/core` |
| React | `npm install @openrouter-auto/react` |
| Python | `pip install openrouter-auto` |
| Go | `go get github.com/faraz152/openrouter-auto-connect/go` |
| Rust | Add to `Cargo.toml` (see below) |

**Rust Cargo.toml:**

```toml
[dependencies]
openrouter-auto = { git = "https://github.com/faraz152/openrouter-auto-connect", subdirectory = "packages/rust" }
```

---

## 3. Hello World

### TypeScript

```typescript
import { OpenRouterAuto } from "@openrouter-auto/core";

const or = new OpenRouterAuto({ apiKey: process.env.OPENROUTER_API_KEY! });
await or.initialize();

const resp = await or.chat({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(resp.choices[0].message.content);
```

### Python

```python
import asyncio
from openrouter_auto.sdk import OpenRouterAuto
from openrouter_auto.types import ChatRequest, ChatMessage

async def main():
    sdk = OpenRouterAuto({"api_key": "sk-or-v1-..."})
    await sdk.fetch_models()

    resp = await sdk.chat(ChatRequest(
        model="openai/gpt-4o-mini",
        messages=[ChatMessage(role="user", content="Hello!")],
    ))
    print(resp.choices[0]["message"]["content"])

asyncio.run(main())
```

### Go

```go
package main

import (
    "fmt"
    "os"
    ora "github.com/faraz152/openrouter-auto-connect/go"
)

func main() {
    client, _ := ora.NewClient(ora.Options{APIKey: os.Getenv("OPENROUTER_API_KEY")})
    client.FetchModels()

    resp, _ := client.Chat(ora.ChatRequest{
        Model:    "openai/gpt-4o-mini",
        Messages: []ora.ChatMessage{{Role: "user", Content: "Hello!"}},
    })
    fmt.Println(resp.Content())
}
```

### Rust

```rust
use openrouter_auto::{Client, Options, ChatRequest, ChatMessage};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new(Options {
        api_key: std::env::var("OPENROUTER_API_KEY")?,
        ..Default::default()
    })?;
    client.fetch_models().await?;

    let resp = client.chat(&ChatRequest::new(
        "openai/gpt-4o-mini",
        vec![ChatMessage::new("user", "Hello!")],
    )).await?;
    println!("{}", resp.content());
    Ok(())
}
```

### React

```tsx
import { OpenRouterProvider, ModelSelector, useOpenRouter } from "@openrouter-auto/react";

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
      <button onClick={() => chat({ model, messages: [{ role: "user", content: "Hello!" }] })}>
        Send
      </button>
    </div>
  );
}
```

---

## 4. Common Tasks

### Browse & Filter Models

```typescript
const models = or.getModels();                               // all 345+ models
const free   = or.filterModels({ freeOnly: true });          // free only
const cheap  = or.filterModels({ maxPrice: 0.001 });         // under $0.001/token
const big    = or.filterModels({ minContextLength: 100000 }); // 100k+ context
```

```python
free  = sdk.filter_models(ModelFilterOptions(free_only=True))
cheap = sdk.filter_models(ModelFilterOptions(max_price=0.001))
```

### Streaming

```typescript
import { StreamAccumulator } from "@openrouter-auto/core";

const acc = new StreamAccumulator();
for await (const chunk of or.streamChat(request)) {
  acc.push(chunk);
  process.stdout.write(acc.content);
}
console.log(acc.toResponse()); // full ChatResponse
```

```python
from openrouter_auto import StreamAccumulator

acc = StreamAccumulator()
async for chunk in sdk.stream_chat(request):
    acc.push(chunk)
    print(acc.content, end="", flush=True)
print(acc.to_response().usage)
```

### Reasoning Models

```python
resp = await sdk.chat(ChatRequest(
    model="deepseek/deepseek-r1",
    messages=[ChatMessage(role="user", content="120 km in 2 h — step by step.")],
    reasoning={"effort": "high"},
    include=["reasoning"],
))
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
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}
resp = await sdk.chat(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Weather in Paris?")],
    tools=[weather_tool],
    tool_choice="auto",
))
tc = resp.choices[0]["message"]["tool_calls"][0]
print(tc["function"]["name"], tc["function"]["arguments"])
```

### Web Search

```python
from openrouter_auto import enable_web_search

resp = await sdk.chat(enable_web_search(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Latest AI news?")],
)))
```

### Vision / Multimodal

```python
resp = await sdk.chat(ChatRequest(
    model="openai/gpt-4.1-mini",
    messages=[ChatMessage(
        role="user",
        content=[
            {"type": "text", "text": "Describe this image."},
            {"type": "image_url", "image_url": {"url": "https://example.com/img.png"}},
        ],
    )],
))
```

### Provider Routing & Fallbacks

```python
resp = await sdk.chat(ChatRequest(
    model="openai/gpt-4o-mini",
    messages=[ChatMessage(role="user", content="Hello!")],
    provider={"allow_fallbacks": True, "sort": "price"},
    models=["openai/gpt-4o-mini", "openai/gpt-4.1-nano"],
    route="fallback",
))
print("Used:", resp.model)
```

### Cost Estimation

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
} catch (err) {
  console.log(err.code);      // "MODEL_NOT_FOUND"
  console.log(err.retryable);  // false
}
```

---

## 5. Python CLI

```bash
export OPENROUTER_API_KEY=sk-or-v1-...

openrouter-auto models              # list all models
openrouter-auto models --free       # free models only
openrouter-auto add anthropic/claude-3.5-sonnet --temperature 0.7
openrouter-auto test anthropic/claude-3.5-sonnet
openrouter-auto chat anthropic/claude-3.5-sonnet "Hello!"
openrouter-auto chat anthropic/claude-3.5-sonnet "Tell me a story" --stream
```

---

## 6. Configuration Reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | **Required.** OpenRouter API key |
| `baseUrl` | `string` | `https://openrouter.ai/api/v1` | API base URL |
| `storageType` | `string` | `"memory"` | `"memory"` / `"localStorage"` / `"file"` |
| `configPath` | `string` | `.openrouter-auto.json` | Path for file storage |
| `autoFetch` | `bool` | `true` | Auto-fetch models on init |
| `fetchInterval` | `number` | `3600000` | Refresh interval (ms) |
| `cacheDuration` | `number` | `3600000` | Cache TTL (ms) |
| `enableTesting` | `bool` | `true` | Test models when adding |
| `testPrompt` | `string` | `"Say hello"` | Test prompt |
| `onError` | `function` | — | Global error callback |
| `onEvent` | `function` | — | Global event callback |

---

## 7. Troubleshooting

| Problem | Solution |
| --- | --- |
| "API key not found" | `export OPENROUTER_API_KEY=sk-or-v1-...` |
| "Model not found" | Call `fetchModels()` / `fetch_models()` first |
| "Rate limited" | Wait a few seconds — `error.retryable` will be `true` |
| "Insufficient credits" | Add credits at [openrouter.ai/credits](https://openrouter.ai/credits) |

---

## Next Steps

- [Full API reference → README.md](README.md)
- [Architecture details → PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- [Examples →](examples/)

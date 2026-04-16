# OpenRouter Auto - Quick Start Guide

Get up and running with OpenRouter Auto in 5 minutes!

## 🚀 Installation

### JavaScript/TypeScript

```bash
npm install openrouter-auto
```

### Python

```bash
pip install openrouter-auto
```

## ⚡ One-Minute Setup

### 1. Get Your API Key

1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Create a new API key
3. Copy the key

### 2. Initialize the SDK

**JavaScript/TypeScript:**

```typescript
import { OpenRouterAuto } from 'openrouter-auto';

const or = new OpenRouterAuto({
  apiKey: 'your-api-key-here',
});

await or.initialize();
```

**Python:**

```python
from openrouter_auto import create_openrouter_auto

or_auto = create_openrouter_auto({
    "api_key": "your-api-key-here",
})

await or_auto.initialize()
```

### 3. Use Any Model

**JavaScript/TypeScript:**

```typescript
// Add a model (auto-configured!)
await or.addModel('anthropic/claude-3.5-sonnet');

// Use it immediately
const response = await or.chat({
  model: 'anthropic/claude-3.5-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

**Python:**

```python
# Add a model (auto-configured!)
await or_auto.add_model("anthropic/claude-3.5-sonnet")

# Use it immediately
response = await or_auto.chat({
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}],
})

print(response.choices[0]["message"]["content"])
```

## 🎨 React Quick Start

```tsx
import { OpenRouterProvider, ModelSelector, useOpenRouter } from 'openrouter-auto/react';

function App() {
  return (
    <OpenRouterProvider apiKey="your-api-key">
      <MyComponent />
    </OpenRouterProvider>
  );
}

function MyComponent() {
  const { chat } = useOpenRouter();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  return (
    <div>
      {/* Auto-fetches all 300+ models */}
      <ModelSelector
        value={selectedModel}
        onChange={(modelId) => setSelectedModel(modelId)}
      />
      
      <button onClick={async () => {
        const response = await chat({
          model: selectedModel,
          messages: [{ role: 'user', content: 'Hello!' }],
        });
        console.log(response);
      }}>
        Send Message
      </button>
    </div>
  );
}
```

## 🐍 Python CLI Quick Start

```bash
# Setup (one time)
openrouter-auto setup

# List all models
openrouter-auto models

# List free models only
openrouter-auto models --free

# Add a model
openrouter-auto add anthropic/claude-3.5-sonnet

# Test a model
openrouter-auto test anthropic/claude-3.5-sonnet

# Chat with a model
openrouter-auto chat anthropic/claude-3.5-sonnet "What is the capital of France?"

# Stream a response
openrouter-auto chat anthropic/claude-3.5-sonnet "Tell me a story" --stream
```

## 📋 Common Tasks

### Browse All Models

```typescript
const models = or.getModels();
console.log(`Available models: ${models.length}`);

// Filter by price
const freeModels = or.filterModels({ freeOnly: true });
const cheapModels = or.filterModels({ maxPrice: 0.001 });
```

### Calculate Costs

```typescript
const cost = or.calculateCost('anthropic/claude-3.5-sonnet', 1000, 500);
console.log(`Estimated cost: $${cost.totalCost}`);
```

### Test Before Using

```typescript
const config = await or.addModel('anthropic/claude-3.5-sonnet');

if (config.testStatus === 'success') {
  console.log('✅ Model is working!');
} else {
  console.log('❌ Model test failed:', config.testError);
}
```

### Handle Errors

```typescript
try {
  await or.chat({ model: 'invalid-model', messages: [] });
} catch (error) {
  console.log(error.code);      // 'MODEL_NOT_FOUND'
  console.log(error.message);   // User-friendly message
  console.log(error.retryable); // Can retry?
}
```

## 💾 Storage Options

### Memory (default, no persistence)

```typescript
const or = new OpenRouterAuto({
  apiKey: '...',
  storageType: 'memory',
});
```

### Config File (Node.js/Python)

```typescript
const or = new OpenRouterAuto({
  apiKey: '...',
  storageType: 'file',
  configPath: './.openrouter-auto.json',
});
```

### LocalStorage (Browser)

```typescript
const or = new OpenRouterAuto({
  apiKey: '...',
  storageType: 'localStorage',
});
```

## 🔧 Configuration

### JavaScript/TypeScript

```typescript
const or = new OpenRouterAuto({
  apiKey: 'your-api-key',
  baseUrl: 'https://openrouter.ai/api/v1',
  storageType: 'file',
  configPath: './.openrouter-auto.json',
  autoFetch: true,           // Auto-fetch models on init
  fetchInterval: 3600000,    // Re-fetch every hour
  cacheDuration: 3600000,    // Cache for 1 hour
  enableTesting: true,       // Test models on add
  testPrompt: 'Hello!',      // Custom test prompt
  onError: (error) => console.error(error),
  onEvent: (event) => console.log(event),
});
```

### Python

```python
or_auto = create_openrouter_auto({
    "api_key": "your-api-key",
    "base_url": "https://openrouter.ai/api/v1",
    "storage_type": "file",
    "config_path": "./.openrouter-auto.json",
    "auto_fetch": True,
    "fetch_interval": 3600,
    "cache_duration": 3600,
    "enable_testing": True,
    "test_prompt": "Hello!",
})
```

## 🆘 Troubleshooting

### "API key not found"

```bash
# Set environment variable
export OPENROUTER_API_KEY="your-api-key"

# Or run setup
openrouter-auto setup
```

### "Model not found"

```typescript
// Fetch models first
await or.fetchModels();

// Then use the model
await or.addModel('anthropic/claude-3.5-sonnet');
```

### "Rate limited"

Wait a few seconds and retry. The SDK will automatically handle retries for you.

### "Insufficient credits"

Visit [OpenRouter Credits](https://openrouter.ai/credits) to add more credits.

## 📚 Next Steps

- Read the [full documentation](README.md)
- Check out [examples](examples/)
- Join our community [Discord](https://discord.gg/openrouter)

---

**Happy coding! 🎉**

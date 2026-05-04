/**
 * SDK-level unit tests for OpenRouterAuto.
 * HTTP calls are intercepted via axios adapters — no real network access.
 */
import { OpenRouterAuto } from "../src/sdk";
import { MemoryStorage } from "../src/storage";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    context_length: 128000,
    created: 0,
    description: "A small but capable model",
    architecture: {
      modality: "text->text",
      input_modalities: ["text"],
      output_modalities: ["text"],
    },
    pricing: {
      prompt: "0.00015",
      completion: "0.0006",
      image: "0",
      request: "0",
    },
    supported_parameters: ["temperature", "max_tokens"],
    top_provider: {
      context_length: 128000,
      max_completion_tokens: 16384,
      is_moderated: false,
    },
    ...overrides,
  };
}

function makeChatResponse(content: string) {
  return {
    id: "chatcmpl-test",
    model: "openai/gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    created: 0,
  };
}

/** Create SDK with a mock axios adapter so nothing hits the network. */
function makeSdk(handlers: Record<string, unknown> = {}) {
  const storage = new MemoryStorage();
  const sdk = new OpenRouterAuto({
    apiKey: "test-key",
    storage,
  });

  // Intercept axios requests
  (sdk as any).axios.defaults.adapter = async (config: any) => {
    const url: string = config.url ?? "";
    const method: string = (config.method ?? "get").toLowerCase();

    // GET /models
    if (method === "get" && url.includes("/models")) {
      const models = (handlers as any).models ?? [makeModel()];
      return { status: 200, data: { data: models }, headers: {}, config };
    }

    // POST /chat/completions
    if (method === "post" && url.includes("/chat/completions")) {
      if ((handlers as any).chatError) {
        const err = new Error("mock error") as any;
        err.response = {
          status: 429,
          data: { error: { message: "rate limit" } },
        };
        throw err;
      }
      const content = (handlers as any).chatContent ?? "Hello from mock!";
      return {
        status: 200,
        data: makeChatResponse(content),
        headers: {},
        config,
      };
    }

    throw new Error(`Unhandled mock request: ${method} ${url}`);
  };

  return { sdk, storage };
}

// ── fetchModels ───────────────────────────────────────────────────────────────

describe("fetchModels", () => {
  it("fetches and caches models from the API", async () => {
    const models = [
      makeModel(),
      makeModel({ id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5" }),
    ];
    const { sdk } = makeSdk({ models });

    const result = await sdk.fetchModels();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("openai/gpt-4o-mini");
    expect(sdk.getModels()).toHaveLength(2);
  });

  it("emits models:updated event with model count", async () => {
    const { sdk } = makeSdk({ models: [makeModel()] });
    const events: unknown[] = [];
    sdk.on("models:updated", (e) => events.push(e));

    await sdk.fetchModels();

    expect(events).toHaveLength(1);
    expect((events[0] as any).payload?.count).toBe(1);
  });

  it("throws OpenRouterAutoError on HTTP error", async () => {
    const { sdk } = makeSdk();
    (sdk as any).axios.defaults.adapter = async () => {
      const err = new Error("auth failed") as any;
      err.response = {
        status: 401,
        data: { error: { message: "Unauthorized" } },
      };
      throw err;
    };

    await expect(sdk.fetchModels()).rejects.toThrow();
  });
});

// ── chat ──────────────────────────────────────────────────────────────────────

describe("chat", () => {
  it("sends a chat request and returns a response", async () => {
    const { sdk } = makeSdk({ chatContent: "Paris!" });

    await sdk.fetchModels();
    const response = await sdk.chat({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Capital of France?" }],
    });

    expect(response.choices[0].message.content).toBe("Paris!");
  });

  it("throws OpenRouterAutoError on MODEL_NOT_FOUND", async () => {
    const { sdk } = makeSdk();
    await sdk.fetchModels();

    await expect(
      sdk.chat({
        model: "no/such-model",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "MODEL_NOT_FOUND" });
  });

  it("throws OpenRouterAutoError on 429 rate limit", async () => {
    const { sdk } = makeSdk({ chatError: true });
    await sdk.fetchModels();

    await expect(
      sdk.chat({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

// ── addModel ─────────────────────────────────────────────────────────────────

describe("addModel", () => {
  it("adds a model with valid parameters", async () => {
    const { sdk } = makeSdk({ chatContent: "Hello!" });
    await sdk.fetchModels();

    const config = await sdk.addModel(
      "openai/gpt-4o-mini",
      { temperature: 0.7 },
      { skipTest: true },
    );

    expect(config.modelId).toBe("openai/gpt-4o-mini");
    expect(config.parameters?.temperature).toBe(0.7);
    expect(config.enabled).toBe(true);
  });

  it("throws INVALID_PARAMETERS for out-of-range temperature", async () => {
    const { sdk } = makeSdk();
    await sdk.fetchModels();

    await expect(
      sdk.addModel(
        "openai/gpt-4o-mini",
        { temperature: 5 },
        { skipTest: true },
      ),
    ).rejects.toMatchObject({ code: "INVALID_PARAMETERS" });
  });

  it("throws MODEL_NOT_FOUND for unknown model", async () => {
    const { sdk } = makeSdk();
    await sdk.fetchModels();

    await expect(
      sdk.addModel("no/such-model", {}, { skipTest: true }),
    ).rejects.toMatchObject({ code: "MODEL_NOT_FOUND" });
  });
});

// ── filterModels ──────────────────────────────────────────────────────────────

describe("filterModels", () => {
  it("filters by freeOnly", async () => {
    const models = [
      makeModel({
        id: "vendor/free:free",
        pricing: { prompt: "0", completion: "0", image: "0", request: "0" },
      }),
      makeModel({
        id: "vendor/paid",
        pricing: {
          prompt: "0.001",
          completion: "0.002",
          image: "0",
          request: "0",
        },
      }),
    ];
    const { sdk } = makeSdk({ models });
    await sdk.fetchModels();

    const free = sdk.filterModels({ freeOnly: true });
    expect(free).toHaveLength(1);
    expect(free[0].id).toBe("vendor/free:free");
  });

  it("filters by search query", async () => {
    const models = [
      makeModel(),
      makeModel({ id: "anthropic/claude", name: "Claude" }),
    ];
    const { sdk } = makeSdk({ models });
    await sdk.fetchModels();

    const results = sdk.filterModels({ search: "gpt" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("openai/gpt-4o-mini");
  });
});

// ── event system ─────────────────────────────────────────────────────────────

describe("event system", () => {
  it("on() and off() work correctly", async () => {
    const { sdk } = makeSdk({ models: [makeModel()] });
    const events: unknown[] = [];

    const unsubscribe = sdk.on("models:updated", (e) => events.push(e));
    await sdk.fetchModels();
    expect(events).toHaveLength(1);

    unsubscribe();
    await sdk.fetchModels();
    expect(events).toHaveLength(1); // no new event after unsubscribe
  });
});

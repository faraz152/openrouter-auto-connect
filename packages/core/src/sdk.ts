/**
 * OpenRouter Auto - Core SDK
 * Main SDK class for auto-configuring and using OpenRouter models
 */

import axios, { AxiosInstance } from "axios";
import { calculateCost, estimateTokens } from "./cost";
import { OpenRouterAutoError, parseOpenRouterError } from "./errors";
import {
  getModelParameters,
  mergeWithDefaults,
  sanitizeParameters,
  validateParameters,
} from "./parameters";
import {
  createStorage,
  getModelConfigs,
  getStoredModels,
  getUserPreferences,
  removeModelConfig,
  setModelConfig,
  setStoredModels,
  setUserPreferences,
  STORAGE_KEYS,
} from "./storage";
import {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  CostEstimate,
  EventHandler,
  ModelConfig,
  ModelFilterOptions,
  ModelTestResult,
  OpenRouterAutoOptions,
  OpenRouterEvent,
  OpenRouterEventType,
  OpenRouterModel,
  StorageAdapter,
  ToolCall,
  UserPreferences,
} from "./types";

// Default test prompt
const DEFAULT_TEST_PROMPT =
  'Say "Hello! This is a test message." and nothing else.';

// Default options
const DEFAULT_OPTIONS: Partial<OpenRouterAutoOptions> = {
  baseUrl: "https://openrouter.ai/api/v1",
  autoFetch: true,
  fetchInterval: 3600000, // 1 hour
  cacheDuration: 3600000, // 1 hour
  enableTesting: true,
  testPrompt: DEFAULT_TEST_PROMPT,
  storageType: "memory",
};

export class OpenRouterAuto {
  private options: OpenRouterAutoOptions;
  private axios: AxiosInstance;
  private storage: StorageAdapter;
  private models: OpenRouterModel[] = [];
  private modelConfigs: Record<string, ModelConfig> = {};
  private eventHandlers: Map<OpenRouterEventType, Set<EventHandler>> =
    new Map();
  private fetchTimer?: NodeJS.Timeout;

  constructor(options: OpenRouterAutoOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize storage
    this.storage =
      this.options.storage ||
      createStorage(
        this.options.storageType || "memory",
        this.options.configPath,
      );

    // Initialize axios
    this.axios = axios.create({
      baseURL: this.options.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000, // 60 second timeout
    });

    // Inject auth header per-request to avoid leaking the key in defaults
    this.axios.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${this.options.apiKey}`;
      return config;
    });
  }

  // ==================== Initialization ====================

  /**
   * Initialize the SDK - load cached models and configs
   */
  async initialize(): Promise<void> {
    // Load cached models
    const cachedModels = await getStoredModels(this.storage);
    if (cachedModels.length > 0) {
      this.models = cachedModels;
    }

    // Load model configs
    this.modelConfigs = await getModelConfigs(this.storage);

    // Fetch fresh models if needed
    const lastFetch = await this.storage.get<number>(STORAGE_KEYS.LAST_FETCH);
    const shouldFetch =
      !lastFetch ||
      Date.now() - lastFetch > (this.options.cacheDuration || 3600000);

    if (shouldFetch || this.models.length === 0) {
      await this.fetchModels();
    }

    // Start auto-fetch after initialization to avoid race conditions
    if (this.options.autoFetch) {
      this.startAutoFetch();
    }
  }

  // ==================== Model Fetching ====================

  /**
   * Fetch all models from OpenRouter API
   */
  async fetchModels(): Promise<OpenRouterModel[]> {
    try {
      const response = await this.axios.get("/models");
      this.models = response.data.data || [];

      // Cache models
      await setStoredModels(this.storage, this.models);
      await this.storage.set(STORAGE_KEYS.LAST_FETCH, Date.now());

      // Emit event
      this.emit("models:updated", { count: this.models.length });

      return this.models;
    } catch (error) {
      const parsedError = parseOpenRouterError(error);
      this.handleError(parsedError);
      throw new OpenRouterAutoError(parsedError);
    }
  }

  /**
   * Get all cached models
   */
  getModels(): OpenRouterModel[] {
    return [...this.models];
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): OpenRouterModel | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  /**
   * Filter models based on criteria
   */
  filterModels(options: ModelFilterOptions = {}): OpenRouterModel[] {
    return this.models.filter((model) => {
      // Modality filter
      if (
        options.modality &&
        model.architecture.modality !== options.modality
      ) {
        return false;
      }

      // Input modalities filter
      if (options.inputModalities) {
        const hasAll = options.inputModalities.every((m) =>
          model.architecture.input_modalities.includes(m),
        );
        if (!hasAll) return false;
      }

      // Output modalities filter
      if (options.outputModalities) {
        const hasAll = options.outputModalities.every((m) =>
          model.architecture.output_modalities.includes(m),
        );
        if (!hasAll) return false;
      }

      // Max price filter
      if (options.maxPrice !== undefined) {
        const promptPrice = parseFloat(model.pricing.prompt) || 0;
        const completionPrice = parseFloat(model.pricing.completion) || 0;
        if (
          promptPrice > options.maxPrice ||
          completionPrice > options.maxPrice
        ) {
          return false;
        }
      }

      // Context length filters
      if (
        options.minContextLength &&
        model.context_length < options.minContextLength
      ) {
        return false;
      }
      if (
        options.maxContextLength &&
        model.context_length > options.maxContextLength
      ) {
        return false;
      }

      // Provider filter
      if (options.provider) {
        const provider = model.id.split("/")[0];
        if (provider !== options.provider) return false;
      }

      // Search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const matches =
          model.id.toLowerCase().includes(searchLower) ||
          model.name.toLowerCase().includes(searchLower) ||
          model.description?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // Supported parameters filter
      if (options.supportedParameters) {
        const hasAll = options.supportedParameters.every((p) =>
          model.supported_parameters?.includes(p),
        );
        if (!hasAll) return false;
      }

      // Exclude models filter
      if (options.excludeModels?.includes(model.id)) {
        return false;
      }

      // Free only filter
      if (options.freeOnly) {
        const promptPrice = parseFloat(model.pricing.prompt) || 0;
        const completionPrice = parseFloat(model.pricing.completion) || 0;
        if (promptPrice > 0 || completionPrice > 0) return false;
      }

      return true;
    });
  }

  // ==================== Model Configuration ====================

  /**
   * Add and configure a model
   */
  async addModel(
    modelId: string,
    parameters: Record<string, any> = {},
  ): Promise<ModelConfig> {
    const model = this.getModel(modelId);
    if (!model) {
      throw new OpenRouterAutoError({
        code: "MODEL_NOT_FOUND",
        message: `Model '${modelId}' not found. Please fetch models first.`,
        retryable: false,
      });
    }

    // Validate parameters
    const validation = validateParameters(model, parameters);
    if (!validation.valid) {
      const errorMessage = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join(", ");
      throw new OpenRouterAutoError({
        code: "INVALID_PARAMETERS",
        message: `Invalid parameters: ${errorMessage}`,
        retryable: false,
      });
    }

    // Create config
    const config: ModelConfig = {
      modelId,
      parameters: mergeWithDefaults(model, parameters),
      enabled: true,
      addedAt: new Date(),
    };

    // Test the model if enabled
    if (this.options.enableTesting) {
      const testResult = await this.testModel(modelId, config.parameters);
      config.testStatus = testResult.success ? "success" : "failed";
      config.testError = testResult.error;
      config.lastTested = new Date();
    }

    // Save config
    this.modelConfigs[modelId] = config;
    await setModelConfig(this.storage, modelId, config);

    // Emit event
    this.emit("model:added", { modelId, config });

    return config;
  }

  /**
   * Remove a model configuration
   */
  async removeModel(modelId: string): Promise<void> {
    delete this.modelConfigs[modelId];
    await removeModelConfig(this.storage, modelId);
    this.emit("model:removed", { modelId });
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.modelConfigs[modelId];
  }

  /**
   * Get all model configurations
   */
  getAllModelConfigs(): Record<string, ModelConfig> {
    return { ...this.modelConfigs };
  }

  /**
   * Update model parameters
   */
  async updateModelParameters(
    modelId: string,
    parameters: Record<string, any>,
  ): Promise<ModelConfig> {
    const config = this.modelConfigs[modelId];
    if (!config) {
      throw new OpenRouterAutoError({
        code: "MODEL_NOT_FOUND",
        message: `Model '${modelId}' is not configured. Add it first.`,
        retryable: false,
      });
    }

    const model = this.getModel(modelId)!;
    const validation = validateParameters(model, parameters);
    if (!validation.valid) {
      throw new OpenRouterAutoError({
        code: "INVALID_PARAMETERS",
        message: `Invalid parameters: ${JSON.stringify(validation.errors)}`,
        retryable: false,
      });
    }

    config.parameters = { ...config.parameters, ...parameters };
    await setModelConfig(this.storage, modelId, config);
    this.emit("config:changed", { modelId, config });

    return config;
  }

  // ==================== Model Testing ====================

  /**
   * Test a model with a basic call
   */
  async testModel(
    modelId: string,
    parameters: Record<string, any> = {},
  ): Promise<ModelTestResult> {
    const startTime = Date.now();

    try {
      const request: ChatRequest = {
        model: modelId,
        messages: [
          {
            role: "user",
            content: this.options.testPrompt || DEFAULT_TEST_PROMPT,
          },
        ],
        max_tokens: 50,
        ...parameters,
      };

      const response = await this.axios.post("/chat/completions", request);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        model: modelId,
        responseTime,
        tokensUsed: response.data.usage?.total_tokens,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const parsedError = parseOpenRouterError(error);

      return {
        success: false,
        model: modelId,
        error: parsedError.message,
        responseTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Test all configured models
   */
  async testAllModels(): Promise<ModelTestResult[]> {
    const results: ModelTestResult[] = [];

    for (const modelId of Object.keys(this.modelConfigs)) {
      const config = this.modelConfigs[modelId];
      const result = await this.testModel(modelId, config.parameters);

      // Update config with test result
      config.testStatus = result.success ? "success" : "failed";
      config.testError = result.error;
      config.lastTested = new Date();
      await setModelConfig(this.storage, modelId, config);

      results.push(result);
      this.emit("model:tested", { modelId, result });
    }

    return results;
  }

  // ==================== Chat/Completion ====================

  /**
   * Send a chat completion request
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = this.getModel(request.model);
    if (!model) {
      throw new OpenRouterAutoError({
        code: "MODEL_NOT_FOUND",
        message: `Model '${request.model}' not found`,
        retryable: false,
      });
    }

    // Get model config if exists
    const config = this.modelConfigs[request.model];

    // Merge parameters: config defaults < request parameters
    const mergedParams = config
      ? { ...config.parameters, ...sanitizeParameters(request) }
      : sanitizeParameters(request);

    // Validate parameters
    const validation = validateParameters(model, mergedParams);
    if (!validation.valid) {
      throw new OpenRouterAutoError({
        code: "INVALID_PARAMETERS",
        message: `Invalid parameters: ${JSON.stringify(validation.errors)}`,
        retryable: false,
      });
    }

    try {
      const response = await this.axios.post("/chat/completions", mergedParams);
      return response.data;
    } catch (error) {
      const parsedError = parseOpenRouterError(error);
      this.handleError(parsedError);
      throw new OpenRouterAutoError(parsedError);
    }
  }

  /**
   * Stream a chat completion (returns async iterator)
   */
  async *streamChat(request: ChatRequest): AsyncGenerator<any, void, unknown> {
    const streamRequest = { ...request, stream: true };

    try {
      const response = await this.axios.post(
        "/chat/completions",
        streamRequest,
        {
          responseType: "stream",
        },
      );

      const stream = response.data;

      for await (const chunk of stream) {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line: string) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      const parsedError = parseOpenRouterError(error);
      this.handleError(parsedError);
      throw new OpenRouterAutoError(parsedError);
    }
  }

  // ==================== Cost Calculation ====================

  /**
   * Calculate cost for a request
   */
  calculateCost(
    modelId: string,
    promptTokens: number,
    completionTokens?: number,
  ): CostEstimate {
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model '${modelId}' not found`);
    }
    return calculateCost(model, promptTokens, completionTokens);
  }

  /**
   * Estimate tokens from text
   */
  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  // ==================== User Preferences ====================

  /**
   * Save user preferences
   */
  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const current = (await getUserPreferences(this.storage)) || {
      apiKey: this.options.apiKey,
    };
    const updated = { ...current, ...preferences };
    // Never persist the API key to storage — strip it before saving
    const { apiKey: _stripped, ...safePreferences } = updated;
    await setUserPreferences(this.storage, safePreferences as UserPreferences);
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences | null> {
    return getUserPreferences(this.storage);
  }

  // ==================== Event System ====================

  /**
   * Subscribe to events
   */
  on(event: OpenRouterEventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  private emit(type: OpenRouterEventType, payload: any): void {
    const event: OpenRouterEvent = {
      type,
      payload,
      timestamp: new Date(),
    };

    // Call global handler if set
    this.options.onEvent?.(event);

    // Call specific handlers
    this.eventHandlers.get(type)?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in event handler:", error);
      }
    });
  }

  // ==================== Auto-fetch ====================

  /**
   * Start auto-fetching models
   */
  startAutoFetch(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
    }

    this.fetchTimer = setInterval(() => {
      this.fetchModels().catch((error) => {
        console.error("Auto-fetch error:", error);
      });
    }, this.options.fetchInterval);
  }

  /**
   * Stop auto-fetching models
   */
  stopAutoFetch(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }
  }

  // ==================== Utility ====================

  /**
   * Get parameter definitions for a model
   */
  getModelParameters(modelId: string) {
    const model = this.getModel(modelId);
    if (!model) return [];
    return getModelParameters(model);
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.options.onError?.(error);
    this.emit("error", error);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopAutoFetch();
    this.eventHandlers.clear();
  }
}

// Export factory function
export function createOpenRouterAuto(
  options: OpenRouterAutoOptions,
): OpenRouterAuto {
  return new OpenRouterAuto(options);
}

// ==================== Stream Accumulator ====================

/**
 * Accumulates streaming chunks into a complete ChatResponse.
 * Handles content, reasoning, and tool_calls deltas.
 *
 * Usage:
 *   const acc = new StreamAccumulator();
 *   for await (const chunk of sdk.streamChat(request)) {
 *     acc.push(chunk);
 *     console.log(acc.content);   // text so far
 *     console.log(acc.reasoning); // reasoning so far
 *   }
 *   const response = acc.toResponse();
 */
export class StreamAccumulator {
  content: string = "";
  reasoning: string = "";
  toolCalls: ToolCall[] = [];
  finishReason: string = "";

  private id: string = "";
  private model: string = "";
  private created: number = 0;
  private usage: ChatResponse["usage"];

  /** Partial tool_calls indexed by position. */
  private toolCallPartials: Map<number, { id: string; type: string; name: string; arguments: string }> = new Map();

  /**
   * Push a raw streaming chunk into the accumulator.
   */
  push(chunk: any): void {
    if (!chunk?.choices?.length) {
      // Final chunk may contain usage only
      if (chunk?.usage) {
        this.usage = chunk.usage;
      }
      return;
    }

    // Top-level fields
    if (chunk.id) this.id = chunk.id;
    if (chunk.model) this.model = chunk.model;
    if (chunk.created) this.created = chunk.created;
    if (chunk.usage) this.usage = chunk.usage;

    const choice = chunk.choices[0];
    const delta = choice?.delta || {};

    // Finish reason
    if (choice.finish_reason) {
      this.finishReason = choice.finish_reason;
    }

    // Content
    if (delta.content) {
      this.content += delta.content;
    }

    // Reasoning (MiniMax, DeepSeek, OpenAI o-series)
    if (delta.reasoning) {
      this.reasoning += delta.reasoning;
    }
    if (delta.reasoning_content) {
      this.reasoning += delta.reasoning_content;
    }

    // Tool calls (incremental)
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let partial = this.toolCallPartials.get(idx);
        if (!partial) {
          partial = { id: "", type: "function", name: "", arguments: "" };
          this.toolCallPartials.set(idx, partial);
        }
        if (tc.id) partial.id = tc.id;
        if (tc.type) partial.type = tc.type;
        if (tc.function?.name) partial.name += tc.function.name;
        if (tc.function?.arguments) partial.arguments += tc.function.arguments;
      }
    }
  }

  /**
   * Build the accumulated tool calls array.
   */
  getToolCalls(): ToolCall[] {
    const calls: ToolCall[] = [];
    const sorted = [...this.toolCallPartials.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, p] of sorted) {
      calls.push({
        id: p.id,
        type: "function",
        function: { name: p.name, arguments: p.arguments },
      });
    }
    return calls;
  }

  /**
   * Build a ChatResponse from accumulated data.
   */
  toResponse(): ChatResponse {
    const toolCalls = this.getToolCalls();
    const message: ChatMessage = {
      role: "assistant",
      content: this.content || null,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    if (this.reasoning) {
      message.reasoning = this.reasoning;
    }

    return {
      id: this.id,
      model: this.model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: this.finishReason,
        },
      ],
      usage: this.usage,
      created: this.created,
    };
  }
}

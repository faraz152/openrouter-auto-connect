/**
 * OpenRouter Auto - Core Types
 * Type definitions for OpenRouter models and API
 */

// Model Architecture
export interface ModelArchitecture {
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  instruct_type?: string;
  tokenizer?: string;
}

// Model Pricing
export interface ModelPricing {
  prompt: string;
  completion: string;
  image: string;
  request: string;
}

// Top Provider Info
export interface TopProvider {
  context_length: number;
  max_completion_tokens: number;
  is_moderated: boolean;
}

// Model Links
export interface ModelLinks {
  details?: string;
}

// Full Model Object from OpenRouter API
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  created: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  supported_parameters: string[];
  top_provider: TopProvider;
  links?: ModelLinks;
  canonical_slug?: string;
}

// Parameter Definition
export interface ParameterDefinition {
  name: string;
  type: "number" | "integer" | "string" | "boolean" | "array";
  description: string;
  default?: any;
  min?: number;
  max?: number;
  enum?: any[];
  required?: boolean;
}

// Model Configuration
export interface ModelConfig {
  modelId: string;
  parameters: Record<string, any>;
  enabled: boolean;
  testStatus?: "pending" | "success" | "failed";
  testError?: string;
  lastTested?: Date;
  addedAt: Date;
}

// User Preferences
export interface UserPreferences {
  apiKey: string;
  defaultModel?: string;
  defaultParameters?: Record<string, any>;
  maxBudget?: number;
  preferredProviders?: string[];
  excludedModels?: string[];
}

// Storage Types
export type StorageType = "memory" | "localStorage" | "file" | "custom";

// Storage Interface
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ==================== Tool Calling Types ====================

// Function definition (used inside a tool)
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

// Tool definition passed in the request
export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

// Tool call returned by the model
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ==================== Reasoning Types ====================

// Reasoning configuration for the request
export interface ReasoningConfig {
  effort?: "low" | "medium" | "high";
  max_tokens?: number;
}

// Reasoning detail block in the response
export interface ReasoningDetail {
  type: string;
  text: string;
  format?: string;
  index?: number;
}

// ==================== Content Types ====================

// Text content part (for multimodal messages)
export interface TextContentPart {
  type: "text";
  text: string;
}

// Image URL content part
export interface ImageUrlContentPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

// Input audio content part
export interface InputAudioContentPart {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
}

// Union of content parts
export type ContentPart =
  | TextContentPart
  | ImageUrlContentPart
  | InputAudioContentPart;

// ==================== Annotation Types ====================

// URL citation from web search
export interface UrlCitation {
  url: string;
  title?: string;
  content?: string;
  start_index?: number;
  end_index?: number;
}

// Annotation on a response message
export interface Annotation {
  type: "url_citation";
  url_citation: UrlCitation;
}

// Chat Message
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[] | null;
  name?: string;
  // Tool calling
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  // Reasoning (response only)
  reasoning?: string;
  reasoning_content?: string;
  reasoning_details?: ReasoningDetail[];
  refusal?: string;
  // Web search annotations (response only)
  annotations?: Annotation[];
}

// ==================== Web Search Types ====================

// User location for web search
export interface WebSearchUserLocation {
  type: "approximate";
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

// Web search tool parameters
export interface WebSearchParameters {
  engine?: "auto" | "native" | "exa" | "firecrawl" | "parallel";
  max_results?: number;
  max_total_results?: number;
  search_context_size?: "low" | "medium" | "high";
  allowed_domains?: string[];
  excluded_domains?: string[];
  user_location?: WebSearchUserLocation;
}

// Web search server tool (passed in tools array)
export interface WebSearchTool {
  type: "openrouter:web_search";
  parameters?: WebSearchParameters;
}

// ==================== Provider Routing Types ====================

export interface ProviderPreferences {
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  data_collection?: "deny" | "allow";
  sort?: "price" | "throughput" | "latency";
  quantizations?: string[];
  ignore?: string[];
}

// ==================== Streaming Types ====================

// Stream options for the request
export interface StreamOptions {
  include_usage?: boolean;
}

// A single streaming chunk from the server
export interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
      tool_calls?: Partial<ToolCall & { index: number }>[];
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: CompletionTokensDetails;
  };
}

// ==================== Plugin Types (legacy) ====================

export interface WebPlugin {
  id: "web";
  engine?: string;
  max_results?: number;
  search_prompt?: string;
  include_domains?: string[];
  exclude_domains?: string[];
}

// Chat Request
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;
  stop?: string | string[];
  stream?: boolean;
  stream_options?: StreamOptions;
  // Tool calling
  tools?: (ToolDefinition | WebSearchTool | Record<string, any>)[];
  tool_choice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
  parallel_tool_calls?: boolean;
  // Reasoning
  reasoning?: ReasoningConfig;
  include?: string[];
  // Response format
  response_format?: any;
  // Provider routing
  provider?: ProviderPreferences;
  models?: string[];
  route?: "fallback";
  // Plugins (legacy — prefer server tools)
  plugins?: (WebPlugin | Record<string, any>)[];
  // Observability / metadata
  metadata?: Record<string, string>;
  trace?: Record<string, any>;
  session_id?: string;
  user?: string;
  // Output modalities
  modalities?: ("text" | "image" | "audio")[];
  // Misc advanced
  logprobs?: boolean;
  top_logprobs?: number;
  cache_control?: Record<string, any>;
  service_tier?: "auto" | "default" | "flex" | "priority" | "scale";
  // Catch-all for forward compatibility
  [key: string]: any;
}

// Token usage details
export interface CompletionTokensDetails {
  reasoning_tokens?: number;
  accepted_prediction_tokens?: number;
  rejected_prediction_tokens?: number;
}

// Chat Response
export interface ChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: CompletionTokensDetails;
  };
  created: number;
}

// Model Test Result
export interface ModelTestResult {
  success: boolean;
  model: string;
  error?: string;
  responseTime: number;
  tokensUsed?: number;
  timestamp: Date;
}

// Error Types
export type OpenRouterErrorCode =
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "INVALID_PARAMETERS"
  | "INSUFFICIENT_CREDITS"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export interface OpenRouterError {
  code: OpenRouterErrorCode;
  message: string;
  details?: any;
  retryable: boolean;
}

// Filter Options
export interface ModelFilterOptions {
  modality?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  maxPrice?: number;
  minContextLength?: number;
  maxContextLength?: number;
  provider?: string;
  search?: string;
  supportedParameters?: string[];
  excludeModels?: string[];
  freeOnly?: boolean;
  /** Filter by price tier: 'free' | 'cheap' | 'moderate' | 'expensive' */
  priceTier?: "free" | "cheap" | "moderate" | "expensive";
}

// Cost Estimate
export interface CostEstimate {
  promptCost: number;
  completionCost: number;
  reasoningCost: number;
  totalCost: number;
  currency: string;
}

// Event Types
export type OpenRouterEventType =
  | "models:updated"
  | "model:added"
  | "model:removed"
  | "model:tested"
  | "config:changed"
  | "error";

export interface OpenRouterEvent {
  type: OpenRouterEventType;
  payload: any;
  timestamp: Date;
}

// Event Handler
export type EventHandler = (event: OpenRouterEvent) => void;

// SDK Options
export interface OpenRouterAutoOptions {
  apiKey: string;
  baseUrl?: string;
  /** Shown in OpenRouter dashboard as the requesting app URL (HTTP-Referer header) */
  siteUrl?: string;
  /** Shown in OpenRouter dashboard as the requesting app name (X-Title header) */
  siteName?: string;
  storage?: StorageAdapter;
  storageType?: StorageType;
  configPath?: string;
  autoFetch?: boolean;
  fetchInterval?: number;
  cacheDuration?: number;
  enableTesting?: boolean;
  testPrompt?: string;
  onError?: (error: OpenRouterError) => void;
  onEvent?: (event: OpenRouterEvent) => void;
}

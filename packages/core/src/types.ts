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
  type: 'number' | 'integer' | 'string' | 'boolean' | 'array';
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
  testStatus?: 'pending' | 'success' | 'failed';
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
export type StorageType = 'memory' | 'localStorage' | 'file' | 'custom';

// Storage Interface
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Chat Message
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

// Chat Request
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  [key: string]: any;
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
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_PARAMETERS'
  | 'INSUFFICIENT_CREDITS'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

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
}

// Cost Estimate
export interface CostEstimate {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
}

// Event Types
export type OpenRouterEventType = 
  | 'models:updated'
  | 'model:added'
  | 'model:removed'
  | 'model:tested'
  | 'config:changed'
  | 'error';

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

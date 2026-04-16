/**
 * OpenRouter Auto - Core SDK
 * Auto-configure and use any OpenRouter model with zero setup
 */

// Types
export * from "./types";

// SDK
export {
  createOpenRouterAuto,
  createWebSearchTool,
  enableWebSearch,
  OpenRouterAuto,
  StreamAccumulator,
} from "./sdk";

// Errors
export {
  formatErrorForDisplay,
  getRetryDelay,
  isRetryableError,
  OpenRouterAutoError,
  parseOpenRouterError,
} from "./errors";

// Storage
export {
  createStorage,
  FileStorageAdapter,
  getModelConfigs,
  getStoredModels,
  getUserPreferences,
  LocalStorageAdapter,
  MemoryStorage,
  removeModelConfig,
  setModelConfig,
  setStoredModels,
  setUserPreferences,
  STORAGE_KEYS,
} from "./storage";

// Parameters
export {
  DEFAULT_PARAMETERS,
  getDefaultParameters,
  getModelParameters,
  getParameterConstraints,
  getParameterHelp,
  isParameterSupported,
  mergeWithDefaults,
  sanitizeParameters,
  validateParameter,
  validateParameters,
} from "./parameters";

// Cost
export {
  calculateChatCost,
  calculateCost,
  calculateMonthlyEstimate,
  compareModelCosts,
  estimateTokens,
  formatCost,
  formatPricePer1K,
  getCheapestModel,
  getCostBreakdown,
  getPriceTier,
  isFreeModel,
} from "./cost";

// Version
export const VERSION = "1.0.0";

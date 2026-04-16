/**
 * OpenRouter Auto - Core SDK
 * Auto-configure and use any OpenRouter model with zero setup
 */

// Types
export * from './types';

// SDK
export { OpenRouterAuto, createOpenRouterAuto, StreamAccumulator, createWebSearchTool, enableWebSearch } from './sdk';

// Errors
export { 
  parseOpenRouterError, 
  isRetryableError, 
  getRetryDelay, 
  formatErrorForDisplay,
  OpenRouterAutoError 
} from './errors';

// Storage
export { 
  createStorage,
  MemoryStorage,
  LocalStorageAdapter,
  FileStorageAdapter,
  STORAGE_KEYS,
  getStoredModels,
  setStoredModels,
  getModelConfigs,
  setModelConfig,
  removeModelConfig,
  getUserPreferences,
  setUserPreferences,
} from './storage';

// Parameters
export {
  DEFAULT_PARAMETERS,
  getModelParameters,
  validateParameter,
  validateParameters,
  getDefaultParameters,
  mergeWithDefaults,
  sanitizeParameters,
  getParameterHelp,
  isParameterSupported,
  getParameterConstraints,
} from './parameters';

// Cost
export {
  calculateCost,
  estimateTokens,
  calculateChatCost,
  formatCost,
  formatPricePer1K,
  compareModelCosts,
  getCheapestModel,
  isFreeModel,
  getPriceTier,
  calculateMonthlyEstimate,
  getCostBreakdown,
} from './cost';

// Version
export const VERSION = '1.0.0';

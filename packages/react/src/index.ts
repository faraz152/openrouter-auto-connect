/**
 * OpenRouter Auto - React
 * React components and hooks for OpenRouter Auto
 */

// Context and Provider
export { OpenRouterProvider, useOpenRouter } from './context';

// Components
export { ModelSelector } from './components/ModelSelector';
export { ModelConfigPanel } from './components/ModelConfigPanel';
export { CostEstimator } from './components/CostEstimator';
export { ErrorDisplay, useErrorDisplay } from './components/ErrorDisplay';

// Re-export core types
export * from '@openrouter-auto/core';

// Version
export const VERSION = '1.0.0';

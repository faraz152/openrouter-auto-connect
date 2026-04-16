/**
 * OpenRouter Auto - Cost Calculator
 * Real-time cost estimation for OpenRouter models
 */

import { OpenRouterModel, CostEstimate } from './types';

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: OpenRouterModel,
  promptTokens: number,
  completionTokens: number = 0
): CostEstimate {
  const pricing = model.pricing;
  
  // Parse pricing (stored as strings)
  const promptPrice = parseFloat(pricing.prompt) || 0;
  const completionPrice = parseFloat(pricing.completion) || 0;
  
  // Calculate costs (prices are per 1K tokens)
  const promptCost = (promptTokens / 1000) * promptPrice;
  const completionCost = (completionTokens / 1000) * completionPrice;
  
  return {
    promptCost,
    completionCost,
    totalCost: promptCost + completionCost,
    currency: 'USD',
  };
}

/**
 * Estimate tokens from text (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for a chat conversation
 */
export function calculateChatCost(
  model: OpenRouterModel,
  messages: { role: string; content: string }[],
  expectedResponseTokens: number = 500
): CostEstimate {
  // Estimate prompt tokens from all messages
  let promptTokens = 0;
  for (const message of messages) {
    promptTokens += estimateTokens(message.content);
    // Add overhead for message format (role, etc.)
    promptTokens += 4;
  }
  
  return calculateCost(model, promptTokens, expectedResponseTokens);
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.000001) return '< $0.000001';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format price per 1K tokens
 */
export function formatPricePer1K(price: string): string {
  const value = parseFloat(price);
  if (value === 0) return 'Free';
  return `$${value.toFixed(6)}/1K tokens`;
}

/**
 * Compare costs between models
 */
export function compareModelCosts(
  models: OpenRouterModel[],
  promptTokens: number,
  completionTokens: number = 500
): Array<{ model: OpenRouterModel; cost: CostEstimate }> {
  return models
    .map(model => ({
      model,
      cost: calculateCost(model, promptTokens, completionTokens),
    }))
    .sort((a, b) => a.cost.totalCost - b.cost.totalCost);
}

/**
 * Get cheapest model for a task
 */
export function getCheapestModel(
  models: OpenRouterModel[],
  promptTokens: number,
  completionTokens: number = 500
): OpenRouterModel | null {
  const sorted = compareModelCosts(models, promptTokens, completionTokens);
  return sorted[0]?.model || null;
}

/**
 * Check if a model is free
 */
export function isFreeModel(model: OpenRouterModel): boolean {
  const promptPrice = parseFloat(model.pricing.prompt) || 0;
  const completionPrice = parseFloat(model.pricing.completion) || 0;
  return promptPrice === 0 && completionPrice === 0;
}

/**
 * Get price tier for a model
 */
export function getPriceTier(model: OpenRouterModel): 'free' | 'cheap' | 'moderate' | 'expensive' {
  const promptPrice = parseFloat(model.pricing.prompt) || 0;
  const completionPrice = parseFloat(model.pricing.completion) || 0;
  const avgPrice = (promptPrice + completionPrice) / 2;
  
  if (avgPrice === 0) return 'free';
  if (avgPrice < 0.0001) return 'cheap';
  if (avgPrice < 0.01) return 'moderate';
  return 'expensive';
}

/**
 * Calculate monthly cost estimate
 */
export function calculateMonthlyEstimate(
  model: OpenRouterModel,
  dailyRequests: number,
  avgPromptTokens: number,
  avgCompletionTokens: number
): CostEstimate {
  const dailyCost = calculateCost(model, avgPromptTokens, avgCompletionTokens);
  const monthlyCost = dailyCost.totalCost * dailyRequests * 30;
  
  return {
    promptCost: dailyCost.promptCost * dailyRequests * 30,
    completionCost: dailyCost.completionCost * dailyRequests * 30,
    totalCost: monthlyCost,
    currency: 'USD',
  };
}

/**
 * Get cost breakdown for display
 */
export function getCostBreakdown(
  model: OpenRouterModel,
  promptTokens: number,
  completionTokens: number = 500
): {
  prompt: string;
  completion: string;
  total: string;
  per1kPrompt: string;
  per1kCompletion: string;
} {
  const cost = calculateCost(model, promptTokens, completionTokens);
  
  return {
    prompt: formatCost(cost.promptCost),
    completion: formatCost(cost.completionCost),
    total: formatCost(cost.totalCost),
    per1kPrompt: formatPricePer1K(model.pricing.prompt),
    per1kCompletion: formatPricePer1K(model.pricing.completion),
  };
}

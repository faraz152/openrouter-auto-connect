/**
 * OpenRouter Auto - Cost Calculator
 * Real-time cost estimation for OpenRouter models
 */

import { CostEstimate, OpenRouterModel } from "./types";

/**
 * Calculate cost for a request
 * Reasoning tokens are billed at the completion rate by default on OpenRouter.
 */
export function calculateCost(
  model: OpenRouterModel,
  promptTokens: number,
  completionTokens: number = 0,
  reasoningTokens: number = 0,
): CostEstimate {
  const pricing = model.pricing;

  // Parse pricing (stored as strings)
  const promptPrice = parseFloat(pricing.prompt) || 0;
  const completionPrice = parseFloat(pricing.completion) || 0;

  // Calculate costs (prices are per 1K tokens)
  const promptCost = (promptTokens / 1000) * promptPrice;
  const completionCost = (completionTokens / 1000) * completionPrice;
  // Reasoning tokens billed at completion rate
  const reasoningCost = (reasoningTokens / 1000) * completionPrice;

  return {
    promptCost,
    completionCost,
    reasoningCost,
    totalCost: promptCost + completionCost + reasoningCost,
    currency: "USD",
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
  expectedResponseTokens: number = 500,
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
  if (cost === 0) return "Free";
  if (cost < 0.000001) return "< $0.000001";
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format price per 1K tokens
 */
export function formatPricePer1K(price: string): string {
  const value = parseFloat(price);
  if (value === 0) return "Free";
  return `$${value.toFixed(6)}/1K tokens`;
}

/**
 * Compare costs between models
 */
export function compareModelCosts(
  models: OpenRouterModel[],
  promptTokens: number,
  completionTokens: number = 500,
): Array<{ model: OpenRouterModel; cost: CostEstimate }> {
  return models
    .map((model) => ({
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
  completionTokens: number = 500,
): OpenRouterModel | null {
  const sorted = compareModelCosts(models, promptTokens, completionTokens);
  return sorted[0]?.model || null;
}

/**
 * Check if a model is free.
 * Catches both zero-price models and OpenRouter's explicit `:free` variant suffix
 * (e.g. "google/gemma-3-27b-it:free") which have lower rate limits than paid variants.
 */
export function isFreeModel(model: OpenRouterModel): boolean {
  if (model.id.endsWith(":free")) return true;
  const promptPrice = parseFloat(model.pricing.prompt) || 0;
  const completionPrice = parseFloat(model.pricing.completion) || 0;
  return promptPrice === 0 && completionPrice === 0;
}

/**
 * Get price tier for a model
 */
export function getPriceTier(
  model: OpenRouterModel,
): "free" | "cheap" | "moderate" | "expensive" {
  if (isFreeModel(model)) return "free";
  const promptPrice = parseFloat(model.pricing.prompt) || 0;
  const completionPrice = parseFloat(model.pricing.completion) || 0;
  const avgPrice = (promptPrice + completionPrice) / 2;

  if (avgPrice < 0.0001) return "cheap";
  if (avgPrice < 0.01) return "moderate";
  return "expensive";
}

/**
 * Get the best free model from a list.
 * Prefers text-only models, sorted by context length (largest first).
 * Free models with the `:free` OpenRouter suffix are included.
 */
export function getBestFreeModel(
  models: OpenRouterModel[],
): OpenRouterModel | null {
  const free = models.filter(
    (m) =>
      isFreeModel(m) &&
      m.architecture.input_modalities.includes("text") &&
      m.architecture.output_modalities.includes("text"),
  );
  if (free.length === 0) return null;
  // Sort by context length descending — more context = more capable
  return free.sort((a, b) => b.context_length - a.context_length)[0];
}

/**
 * Calculate monthly cost estimate
 */
export function calculateMonthlyEstimate(
  model: OpenRouterModel,
  dailyRequests: number,
  avgPromptTokens: number,
  avgCompletionTokens: number,
): CostEstimate {
  const dailyCost = calculateCost(model, avgPromptTokens, avgCompletionTokens);
  const monthlyCost = dailyCost.totalCost * dailyRequests * 30;

  return {
    promptCost: dailyCost.promptCost * dailyRequests * 30,
    completionCost: dailyCost.completionCost * dailyRequests * 30,
    reasoningCost: dailyCost.reasoningCost * dailyRequests * 30,
    totalCost: monthlyCost,
    currency: "USD",
  };
}

/**
 * Get cost breakdown for display
 */
export function getCostBreakdown(
  model: OpenRouterModel,
  promptTokens: number,
  completionTokens: number = 500,
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

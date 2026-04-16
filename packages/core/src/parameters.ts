/**
 * OpenRouter Auto - Parameter Management
 * Dynamic parameter validation and configuration
 */

import { OpenRouterModel, ParameterDefinition } from "./types";
import registryParams from "../../registry/parameters.json";
import platformParamsList from "../../registry/platform-params.json";

// Build DEFAULT_PARAMETERS from registry JSON
export const DEFAULT_PARAMETERS: Record<string, ParameterDefinition> = {};
for (const [name, def] of Object.entries(
  registryParams as Record<string, Record<string, any>>,
)) {
  DEFAULT_PARAMETERS[name] = { name, required: false, ...def } as ParameterDefinition;
}

/**
 * Get parameter definitions for a specific model
 * Returns only the parameters supported by the model
 */
export function getModelParameters(
  model: OpenRouterModel,
): ParameterDefinition[] {
  const supported = model.supported_parameters || [];
  const definitions: ParameterDefinition[] = [];

  for (const paramName of supported) {
    const definition = DEFAULT_PARAMETERS[paramName];
    if (definition) {
      // Adjust max_tokens based on model's context length
      if (
        paramName === "max_tokens" &&
        model.top_provider?.max_completion_tokens
      ) {
        definitions.push({
          ...definition,
          max: model.top_provider.max_completion_tokens,
        });
      } else if (paramName === "max_tokens" && model.context_length) {
        definitions.push({
          ...definition,
          max: model.context_length,
        });
      } else {
        definitions.push(definition);
      }
    }
  }

  return definitions;
}

/**
 * Validate a parameter value
 */
export function validateParameter(
  name: string,
  value: any,
  definition: ParameterDefinition,
): { valid: boolean; error?: string } {
  // Check type
  if (value !== undefined && value !== null) {
    if (definition.type === "number" && typeof value !== "number") {
      return { valid: false, error: `${name} must be a number` };
    }
    if (definition.type === "integer" && !Number.isInteger(value)) {
      return { valid: false, error: `${name} must be an integer` };
    }
    if (definition.type === "boolean" && typeof value !== "boolean") {
      return { valid: false, error: `${name} must be a boolean` };
    }
    if (definition.type === "string" && typeof value !== "string") {
      return { valid: false, error: `${name} must be a string` };
    }
    if (definition.type === "array" && !Array.isArray(value)) {
      return { valid: false, error: `${name} must be an array` };
    }

    // Check range
    if (definition.min !== undefined && value < definition.min) {
      return {
        valid: false,
        error: `${name} must be at least ${definition.min}`,
      };
    }
    if (definition.max !== undefined && value > definition.max) {
      return {
        valid: false,
        error: `${name} must be at most ${definition.max}`,
      };
    }

    // Check enum
    if (definition.enum && !definition.enum.includes(value)) {
      return {
        valid: false,
        error: `${name} must be one of: ${definition.enum.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate all parameters for a model
 */
/**
 * OpenRouter platform-level parameters that are always allowed
 * regardless of the model's supported_parameters list.
 */
const PLATFORM_PARAMS = new Set(platformParamsList);

export function validateParameters(
  model: OpenRouterModel,
  params: Record<string, any>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const supported = model.supported_parameters || [];

  // Check for unsupported parameters (skip platform-level params)
  for (const key of Object.keys(params)) {
    if (!supported.includes(key) && !PLATFORM_PARAMS.has(key)) {
      errors[key] = `Parameter '${key}' is not supported by this model`;
    }
  }

  // Validate supported parameters
  const definitions = getModelParameters(model);
  for (const definition of definitions) {
    const value = params[definition.name];
    if (value !== undefined) {
      const result = validateParameter(definition.name, value, definition);
      if (!result.valid) {
        errors[definition.name] = result.error!;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get default parameters for a model
 */
export function getDefaultParameters(
  model: OpenRouterModel,
): Record<string, any> {
  const defaults: Record<string, any> = {};
  const definitions = getModelParameters(model);

  for (const definition of definitions) {
    if (definition.default !== undefined) {
      defaults[definition.name] = definition.default;
    }
  }

  return defaults;
}

/**
 * Merge user parameters with defaults
 */
export function mergeWithDefaults(
  model: OpenRouterModel,
  userParams: Record<string, any>,
): Record<string, any> {
  const defaults = getDefaultParameters(model);
  return {
    ...defaults,
    ...userParams,
  };
}

/**
 * Sanitize parameters (remove undefined/null values)
 */
export function sanitizeParameters(
  params: Record<string, any>,
): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get parameter help text
 */
export function getParameterHelp(name: string): string {
  const definition = DEFAULT_PARAMETERS[name];
  return definition?.description || "No description available";
}

/**
 * Check if a parameter is supported by a model
 */
export function isParameterSupported(
  model: OpenRouterModel,
  paramName: string,
): boolean {
  return model.supported_parameters?.includes(paramName) || false;
}

/**
 * Get parameter constraints for UI display
 */
export function getParameterConstraints(definition: ParameterDefinition): {
  min?: number;
  max?: number;
  step?: number;
} {
  const constraints: { min?: number; max?: number; step?: number } = {};

  if (definition.min !== undefined) {
    constraints.min = definition.min;
  }
  if (definition.max !== undefined) {
    constraints.max = definition.max;
  }
  if (definition.type === "number") {
    constraints.step = 0.1;
  } else if (definition.type === "integer") {
    constraints.step = 1;
  }

  return constraints;
}

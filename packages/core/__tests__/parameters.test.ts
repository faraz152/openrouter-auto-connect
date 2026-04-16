import {
  DEFAULT_PARAMETERS,
  getModelParameters,
  validateParameter,
  validateParameters,
  getDefaultParameters,
  mergeWithDefaults,
  sanitizeParameters,
} from '../src/parameters';
import { OpenRouterModel } from '../src/types';

// Minimal model fixture
function makeModel(overrides: Partial<OpenRouterModel> = {}): OpenRouterModel {
  return {
    id: 'test/model',
    name: 'Test Model',
    context_length: 4096,
    created: Date.now(),
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
    },
    pricing: { prompt: '0.001', completion: '0.002', image: '0', request: '0' },
    supported_parameters: ['temperature', 'max_tokens', 'top_p'],
    top_provider: { context_length: 4096, max_completion_tokens: 2048, is_moderated: false },
    ...overrides,
  };
}

describe('validateParameter', () => {
  it('accepts a valid temperature', () => {
    const def = DEFAULT_PARAMETERS.temperature;
    const { valid } = validateParameter('temperature', 0.7, def);
    expect(valid).toBe(true);
  });

  it('rejects temperature above max', () => {
    const def = DEFAULT_PARAMETERS.temperature;
    const { valid, error } = validateParameter('temperature', 3.0, def);
    expect(valid).toBe(false);
    expect(error).toContain('at most');
  });

  it('rejects non-integer for integer param', () => {
    const def = DEFAULT_PARAMETERS.max_tokens;
    const { valid, error } = validateParameter('max_tokens', 10.5, def);
    expect(valid).toBe(false);
    expect(error).toContain('integer');
  });
});

describe('validateParameters', () => {
  it('passes with valid parameters', () => {
    const model = makeModel();
    const { valid, errors } = validateParameters(model, { temperature: 1.0 });
    expect(valid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('rejects unsupported parameters', () => {
    const model = makeModel({ supported_parameters: ['temperature'] });
    const { valid, errors } = validateParameters(model, { seed: 42 });
    expect(valid).toBe(false);
    expect(errors.seed).toBeDefined();
  });
});

describe('mergeWithDefaults', () => {
  it('fills in defaults for missing params', () => {
    const model = makeModel();
    const merged = mergeWithDefaults(model, { max_tokens: 100 });
    expect(merged.temperature).toBe(1.0);
    expect(merged.max_tokens).toBe(100);
  });

  it('user params override defaults', () => {
    const model = makeModel();
    const merged = mergeWithDefaults(model, { temperature: 0.5 });
    expect(merged.temperature).toBe(0.5);
  });
});

describe('sanitizeParameters', () => {
  it('removes undefined and null values', () => {
    const result = sanitizeParameters({ a: 1, b: undefined, c: null, d: 'ok' });
    expect(result).toEqual({ a: 1, d: 'ok' });
  });
});

describe('getModelParameters', () => {
  it('returns only supported parameters', () => {
    const model = makeModel({ supported_parameters: ['temperature'] });
    const defs = getModelParameters(model);
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('temperature');
  });

  it('adjusts max_tokens max from top_provider', () => {
    const model = makeModel();
    const defs = getModelParameters(model);
    const maxTokensDef = defs.find(d => d.name === 'max_tokens');
    expect(maxTokensDef?.max).toBe(2048);
  });
});

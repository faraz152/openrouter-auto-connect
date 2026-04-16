import { calculateCost, estimateTokens, formatCost, isFreeModel, getPriceTier } from '../src/cost';
import { OpenRouterModel } from '../src/types';

function makeModel(prompt: string = '0.001', completion: string = '0.002'): OpenRouterModel {
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
    pricing: { prompt, completion, image: '0', request: '0' },
    supported_parameters: [],
    top_provider: { context_length: 4096, max_completion_tokens: 2048, is_moderated: false },
  };
}

describe('calculateCost', () => {
  it('calculates prompt and completion costs', () => {
    const model = makeModel('0.001', '0.002');
    const cost = calculateCost(model, 1000, 500);
    expect(cost.promptCost).toBeCloseTo(0.001);
    expect(cost.completionCost).toBeCloseTo(0.001);
    expect(cost.totalCost).toBeCloseTo(0.002);
    expect(cost.currency).toBe('USD');
  });

  it('returns zero for free model', () => {
    const model = makeModel('0', '0');
    const cost = calculateCost(model, 1000, 500);
    expect(cost.totalCost).toBe(0);
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates roughly 1 token per 4 chars', () => {
    const tokens = estimateTokens('Hello, world!'); // 13 chars -> ~4 tokens
    expect(tokens).toBeGreaterThanOrEqual(3);
    expect(tokens).toBeLessThanOrEqual(5);
  });
});

describe('formatCost', () => {
  it('returns "Free" for zero', () => {
    expect(formatCost(0)).toBe('Free');
  });

  it('formats small costs with precision', () => {
    expect(formatCost(0.0001)).toMatch(/\$0\.000[01]/);
  });
});

describe('isFreeModel', () => {
  it('returns true for free pricing', () => {
    expect(isFreeModel(makeModel('0', '0'))).toBe(true);
  });

  it('returns false for paid pricing', () => {
    expect(isFreeModel(makeModel('0.001', '0.002'))).toBe(false);
  });
});

describe('getPriceTier', () => {
  it('returns "free" for zero pricing', () => {
    expect(getPriceTier(makeModel('0', '0'))).toBe('free');
  });

  it('returns "expensive" for high pricing', () => {
    expect(getPriceTier(makeModel('0.1', '0.1'))).toBe('expensive');
  });
});

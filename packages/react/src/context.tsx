/**
 * OpenRouter Auto - React Context
 * Provider and context for OpenRouter Auto SDK
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  OpenRouterAuto,
  OpenRouterAutoOptions,
  OpenRouterModel,
  ModelConfig,
  ModelFilterOptions,
  ChatRequest,
  ChatResponse,
  OpenRouterEvent,
  OpenRouterError,
  CostEstimate,
  createOpenRouterAuto,
} from '@openrouter-auto/core';

// Context state interface
interface OpenRouterContextState {
  // SDK instance
  sdk: OpenRouterAuto | null;
  
  // State
  models: OpenRouterModel[];
  selectedModel: string | null;
  modelConfigs: Record<string, ModelConfig>;
  isLoading: boolean;
  error: OpenRouterError | null;
  
  // Actions
  fetchModels: () => Promise<void>;
  selectModel: (modelId: string) => void;
  addModel: (modelId: string, parameters?: Record<string, any>) => Promise<ModelConfig>;
  removeModel: (modelId: string) => Promise<void>;
  updateModelParameters: (modelId: string, parameters: Record<string, any>) => Promise<ModelConfig>;
  testModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
  chat: (request: ChatRequest) => Promise<ChatResponse>;
  streamChat: (request: ChatRequest) => AsyncGenerator<any, void, unknown>;
  
  // Utilities
  filterModels: (options: ModelFilterOptions) => OpenRouterModel[];
  getModel: (modelId: string) => OpenRouterModel | undefined;
  getModelConfig: (modelId: string) => ModelConfig | undefined;
  calculateCost: (modelId: string, promptTokens: number, completionTokens?: number) => CostEstimate;
  
  // Parameters
  getModelParameters: (modelId: string) => any[];
}

// Create context
const OpenRouterContext = createContext<OpenRouterContextState | null>(null);

// Provider props
interface OpenRouterProviderProps {
  children: ReactNode;
  apiKey: string;
  options?: Partial<Omit<OpenRouterAutoOptions, 'apiKey'>>;
  onError?: (error: OpenRouterError) => void;
  onEvent?: (event: OpenRouterEvent) => void;
}

// Provider component
export function OpenRouterProvider({
  children,
  apiKey,
  options = {},
  onError,
  onEvent,
}: OpenRouterProviderProps) {
  const [sdk, setSdk] = useState<OpenRouterAuto | null>(null);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<OpenRouterError | null>(null);

  // Initialize SDK
  useEffect(() => {
    const instance = createOpenRouterAuto({
      apiKey,
      ...options,
      onError: (err) => {
        setError(err);
        onError?.(err);
      },
      onEvent: (event) => {
        onEvent?.(event);
        
        // Update state based on events
        if (event.type === 'models:updated') {
          setModels(instance.getModels());
        } else if (event.type === 'model:added' || event.type === 'model:removed') {
          setModelConfigs(instance.getAllModelConfigs());
        } else if (event.type === 'config:changed') {
          setModelConfigs(instance.getAllModelConfigs());
        }
      },
    });

    setSdk(instance);

    // Initialize and fetch models
    const init = async () => {
      setIsLoading(true);
      try {
        await instance.initialize();
        setModels(instance.getModels());
        setModelConfigs(instance.getAllModelConfigs());
      } catch (err: any) {
        setError(err);
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Cleanup
    return () => {
      instance.dispose();
    };
  }, [apiKey]);

  // Fetch models
  const fetchModels = useCallback(async () => {
    if (!sdk) return;
    setIsLoading(true);
    setError(null);
    try {
      await sdk.fetchModels();
      setModels(sdk.getModels());
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Select model
  const selectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  // Add model
  const addModel = useCallback(async (modelId: string, parameters: Record<string, any> = {}) => {
    if (!sdk) throw new Error('SDK not initialized');
    setIsLoading(true);
    setError(null);
    try {
      const config = await sdk.addModel(modelId, parameters);
      setModelConfigs(sdk.getAllModelConfigs());
      return config;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Remove model
  const removeModel = useCallback(async (modelId: string) => {
    if (!sdk) return;
    setIsLoading(true);
    try {
      await sdk.removeModel(modelId);
      setModelConfigs(sdk.getAllModelConfigs());
      if (selectedModel === modelId) {
        setSelectedModel(null);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, selectedModel]);

  // Update model parameters
  const updateModelParameters = useCallback(async (modelId: string, parameters: Record<string, any>) => {
    if (!sdk) throw new Error('SDK not initialized');
    setIsLoading(true);
    setError(null);
    try {
      const config = await sdk.updateModelParameters(modelId, parameters);
      setModelConfigs(sdk.getAllModelConfigs());
      return config;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Test model
  const testModel = useCallback(async (modelId: string) => {
    if (!sdk) return { success: false, error: 'SDK not initialized' };
    setIsLoading(true);
    try {
      const result = await sdk.testModel(modelId);
      setModelConfigs(sdk.getAllModelConfigs());
      return {
        success: result.success,
        error: result.error,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Chat
  const chat = useCallback(async (request: ChatRequest) => {
    if (!sdk) throw new Error('SDK not initialized');
    setError(null);
    try {
      return await sdk.chat(request);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [sdk]);

  // Stream chat
  const streamChat = useCallback(async function* (request: ChatRequest) {
    if (!sdk) throw new Error('SDK not initialized');
    setError(null);
    try {
      yield* sdk.streamChat(request);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [sdk]);

  // Filter models
  const filterModels = useCallback((options: ModelFilterOptions) => {
    if (!sdk) return [];
    return sdk.filterModels(options);
  }, [sdk]);

  // Get model
  const getModel = useCallback((modelId: string) => {
    if (!sdk) return undefined;
    return sdk.getModel(modelId);
  }, [sdk]);

  // Get model config
  const getModelConfig = useCallback((modelId: string) => {
    if (!sdk) return undefined;
    return sdk.getModelConfig(modelId);
  }, [sdk]);

  // Calculate cost
  const calculateCost = useCallback((modelId: string, promptTokens: number, completionTokens?: number) => {
    if (!sdk) throw new Error('SDK not initialized');
    return sdk.calculateCost(modelId, promptTokens, completionTokens);
  }, [sdk]);

  // Get model parameters
  const getModelParameters = useCallback((modelId: string) => {
    if (!sdk) return [];
    return sdk.getModelParameters(modelId);
  }, [sdk]);

  const value: OpenRouterContextState = {
    sdk,
    models,
    selectedModel,
    modelConfigs,
    isLoading,
    error,
    fetchModels,
    selectModel,
    addModel,
    removeModel,
    updateModelParameters,
    testModel,
    chat,
    streamChat,
    filterModels,
    getModel,
    getModelConfig,
    calculateCost,
    getModelParameters,
  };

  return (
    <OpenRouterContext.Provider value={value}>
      {children}
    </OpenRouterContext.Provider>
  );
}

// Hook to use the context
export function useOpenRouter(): OpenRouterContextState {
  const context = useContext(OpenRouterContext);
  if (!context) {
    throw new Error('useOpenRouter must be used within an OpenRouterProvider');
  }
  return context;
}

/**
 * OpenRouter Auto - Storage Adapters
 * Multiple storage options: memory, localStorage, file, custom
 */

import { StorageAdapter, StorageType, UserPreferences, ModelConfig } from './types';

// In-memory storage (default for Node.js)
class MemoryStorage implements StorageAdapter {
  private store: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Keys that must never be persisted to browser localStorage
const SENSITIVE_KEYS = ['apiKey', 'api_key'];

// LocalStorage adapter (for browser)
class LocalStorageAdapter implements StorageAdapter {
  private prefix: string = 'ora_';

  async get<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const item = window.localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      // Strip sensitive fields before writing to localStorage
      let safeValue = value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = { ...(value as Record<string, unknown>) };
        for (const k of SENSITIVE_KEYS) {
          delete obj[k];
        }
        safeValue = obj as unknown as T;
      }
      window.localStorage.setItem(this.prefix + key, JSON.stringify(safeValue));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach(key => window.localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
}

// File storage adapter (for Node.js with config file)
class FileStorageAdapter implements StorageAdapter {
  private configPath: string;
  private data: Record<string, any> = {};
  private fs: any;
  private path: any;

  constructor(configPath: string = './.openrouter-auto.json') {
    this.configPath = configPath;
    
    // Dynamic import for Node.js modules
    try {
      this.fs = require('fs');
      this.path = require('path');
      this.loadFromFile();
    } catch (error) {
      console.warn('File storage not available in browser environment');
    }
  }

  private loadFromFile(): void {
    if (!this.fs) return;
    
    try {
      if (this.fs.existsSync(this.configPath)) {
        const content = this.fs.readFileSync(this.configPath, 'utf-8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading config file:', error);
      this.data = {};
    }
  }

  private saveToFile(): void {
    if (!this.fs) return;
    
    try {
      const dir = this.path.dirname(this.configPath);
      if (!this.fs.existsSync(dir)) {
        this.fs.mkdirSync(dir, { recursive: true });
      }
      this.fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.data, null, 2),
        { encoding: 'utf-8', mode: 0o600 }
      );
    } catch (error) {
      console.error('Error saving config file:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return this.data[key] || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data[key] = value;
    this.saveToFile();
  }

  async remove(key: string): Promise<void> {
    delete this.data[key];
    this.saveToFile();
  }

  async clear(): Promise<void> {
    this.data = {};
    this.saveToFile();
  }

  // Get full config object
  getConfig(): Record<string, any> {
    return { ...this.data };
  }

  // Set full config object
  setConfig(config: Record<string, any>): void {
    this.data = { ...config };
    this.saveToFile();
  }
}

// Storage factory
export function createStorage(type: StorageType, configPath?: string): StorageAdapter {
  switch (type) {
    case 'localStorage':
      return new LocalStorageAdapter();
    case 'file':
      return new FileStorageAdapter(configPath);
    case 'memory':
    default:
      return new MemoryStorage();
  }
}

// Storage keys
export const STORAGE_KEYS = {
  MODELS: 'models',
  MODEL_CONFIGS: 'model_configs',
  USER_PREFERENCES: 'user_preferences',
  LAST_FETCH: 'last_fetch',
  MODEL_CACHE: 'model_cache',
} as const;

// Helper functions for common storage operations
export async function getStoredModels(storage: StorageAdapter): Promise<any[]> {
  return (await storage.get(STORAGE_KEYS.MODELS)) || [];
}

export async function setStoredModels(storage: StorageAdapter, models: any[]): Promise<void> {
  return storage.set(STORAGE_KEYS.MODELS, models);
}

export async function getModelConfigs(storage: StorageAdapter): Promise<Record<string, ModelConfig>> {
  return (await storage.get(STORAGE_KEYS.MODEL_CONFIGS)) || {};
}

export async function setModelConfig(
  storage: StorageAdapter,
  modelId: string,
  config: ModelConfig
): Promise<void> {
  const configs = await getModelConfigs(storage);
  configs[modelId] = config;
  return storage.set(STORAGE_KEYS.MODEL_CONFIGS, configs);
}

export async function removeModelConfig(storage: StorageAdapter, modelId: string): Promise<void> {
  const configs = await getModelConfigs(storage);
  delete configs[modelId];
  return storage.set(STORAGE_KEYS.MODEL_CONFIGS, configs);
}

export async function getUserPreferences(storage: StorageAdapter): Promise<UserPreferences | null> {
  return storage.get(STORAGE_KEYS.USER_PREFERENCES);
}

export async function setUserPreferences(
  storage: StorageAdapter,
  preferences: UserPreferences
): Promise<void> {
  return storage.set(STORAGE_KEYS.USER_PREFERENCES, preferences);
}

export async function getLastFetchTime(storage: StorageAdapter): Promise<number | null> {
  return storage.get(STORAGE_KEYS.LAST_FETCH);
}

export async function setLastFetchTime(storage: StorageAdapter, timestamp: number): Promise<void> {
  return storage.set(STORAGE_KEYS.LAST_FETCH, timestamp);
}

export { MemoryStorage, LocalStorageAdapter, FileStorageAdapter };

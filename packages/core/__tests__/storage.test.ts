import {
  MemoryStorage,
  getModelConfigs,
  getStoredModels,
  removeModelConfig,
  setModelConfig,
  setStoredModels,
} from "../src/storage";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("should return null for missing keys", async () => {
    const result = await storage.get("nonexistent");
    expect(result).toBeNull();
  });

  it("should store and retrieve values", async () => {
    await storage.set("key", { foo: "bar" });
    const result = await storage.get<{ foo: string }>("key");
    expect(result).toEqual({ foo: "bar" });
  });

  it("should remove values", async () => {
    await storage.set("key", "value");
    await storage.remove("key");
    const result = await storage.get("key");
    expect(result).toBeNull();
  });

  it("should clear all values", async () => {
    await storage.set("a", 1);
    await storage.set("b", 2);
    await storage.clear();
    expect(await storage.get("a")).toBeNull();
    expect(await storage.get("b")).toBeNull();
  });
});

describe("Storage helpers", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("getStoredModels returns empty array when no models stored", async () => {
    const models = await getStoredModels(storage);
    expect(models).toEqual([]);
  });

  it("setStoredModels / getStoredModels round-trips", async () => {
    const models = [{ id: "test/model", name: "Test" }];
    await setStoredModels(storage, models);
    const result = await getStoredModels(storage);
    expect(result).toEqual(models);
  });

  it("getModelConfigs returns empty object when none stored", async () => {
    const configs = await getModelConfigs(storage);
    expect(configs).toEqual({});
  });

  it("setModelConfig / getModelConfigs round-trips", async () => {
    const config = {
      modelId: "test/model",
      parameters: { temperature: 0.7 },
      enabled: true,
      addedAt: new Date(),
    };
    await setModelConfig(storage, "test/model", config as any);
    const configs = await getModelConfigs(storage);
    expect(configs["test/model"]).toMatchObject({
      modelId: "test/model",
      parameters: { temperature: 0.7 },
    });
  });

  it("removeModelConfig removes the config", async () => {
    const config = {
      modelId: "test/model",
      parameters: {},
      enabled: true,
      addedAt: new Date(),
    };
    await setModelConfig(storage, "test/model", config as any);
    await removeModelConfig(storage, "test/model");
    const configs = await getModelConfigs(storage);
    expect(configs["test/model"]).toBeUndefined();
  });
});

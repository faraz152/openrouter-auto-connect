"""Tests for storage adapters"""

import pytest
from openrouter_auto.storage import (
    MemoryStorage,
    create_storage,
    get_stored_models,
    set_stored_models,
    get_model_configs,
    set_model_config,
    remove_model_config,
    STORAGE_KEYS,
)


@pytest.fixture
def storage():
    return MemoryStorage()


@pytest.mark.asyncio
async def test_memory_get_missing_key(storage):
    result = await storage.get("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_memory_set_and_get(storage):
    await storage.set("key", {"foo": "bar"})
    result = await storage.get("key")
    assert result == {"foo": "bar"}


@pytest.mark.asyncio
async def test_memory_remove(storage):
    await storage.set("key", "value")
    await storage.remove("key")
    result = await storage.get("key")
    assert result is None


@pytest.mark.asyncio
async def test_memory_clear(storage):
    await storage.set("a", 1)
    await storage.set("b", 2)
    await storage.clear()
    assert await storage.get("a") is None
    assert await storage.get("b") is None


@pytest.mark.asyncio
async def test_get_stored_models_empty(storage):
    models = await get_stored_models(storage)
    assert models == []


@pytest.mark.asyncio
async def test_set_and_get_stored_models(storage):
    models = [{"id": "test/model", "name": "Test"}]
    await set_stored_models(storage, models)
    result = await get_stored_models(storage)
    assert result == models


@pytest.mark.asyncio
async def test_get_model_configs_empty(storage):
    configs = await get_model_configs(storage)
    assert configs == {}


@pytest.mark.asyncio
async def test_set_and_get_model_config(storage):
    from openrouter_auto.types import ModelConfig

    config = ModelConfig(
        model_id="test/model",
        parameters={"temperature": 0.7},
        enabled=True,
    )
    await set_model_config(storage, "test/model", config)
    configs = await get_model_configs(storage)
    assert "test/model" in configs


@pytest.mark.asyncio
async def test_remove_model_config(storage):
    from openrouter_auto.types import ModelConfig

    config = ModelConfig(model_id="test/model", parameters={}, enabled=True)
    await set_model_config(storage, "test/model", config)
    await remove_model_config(storage, "test/model")
    configs = await get_model_configs(storage)
    assert "test/model" not in configs


def test_create_storage_memory():
    s = create_storage("memory")
    assert isinstance(s, MemoryStorage)


def test_create_storage_unknown_raises():
    with pytest.raises(ValueError):
        create_storage("unknown_type")

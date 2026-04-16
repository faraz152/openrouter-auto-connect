"""
OpenRouter Auto - Storage Adapters
Multiple storage options: memory, file
"""

import json
import os
from typing import Optional, Dict, Any, TypeVar, Generic
from abc import ABC, abstractmethod
from pathlib import Path

T = TypeVar("T")


class StorageAdapter(ABC):
    """Abstract base class for storage adapters"""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        pass

    @abstractmethod
    async def set(self, key: str, value: Any) -> None:
        """Set value by key"""
        pass

    @abstractmethod
    async def remove(self, key: str) -> None:
        """Remove value by key"""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all values"""
        pass


class MemoryStorage(StorageAdapter):
    """In-memory storage adapter"""

    def __init__(self):
        self._store: Dict[str, Any] = {}

    async def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)

    async def set(self, key: str, value: Any) -> None:
        self._store[key] = value

    async def remove(self, key: str) -> None:
        self._store.pop(key, None)

    async def clear(self) -> None:
        self._store.clear()


class FileStorage(StorageAdapter):
    """File-based storage adapter"""

    def __init__(self, config_path: str = "./.openrouter-auto.json"):
        resolved = Path(config_path).resolve()
        # Guard against path traversal — config must live under CWD or user home
        allowed_roots = [Path.cwd().resolve(), Path.home().resolve()]
        if not any(str(resolved).startswith(str(root)) for root in allowed_roots):
            raise ValueError(
                f"configPath '{config_path}' resolves outside CWD and HOME. "
                "This is not allowed to prevent path traversal."
            )
        self.config_path = resolved
        self._data: Dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load data from file"""
        try:
            if self.config_path.exists():
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
        except Exception as e:
            print(f"Error loading config file: {e}")
            self._data = {}

    def _save(self) -> None:
        """Save data to file"""
        import stat
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, default=str)
            # Restrict to owner read/write only
            self.config_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except Exception as e:
            print(f"Error saving config file: {e}")

    async def get(self, key: str) -> Optional[Any]:
        return self._data.get(key)

    async def set(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._save()

    async def remove(self, key: str) -> None:
        if key in self._data:
            del self._data[key]
            self._save()

    async def clear(self) -> None:
        self._data.clear()
        self._save()

    def get_config(self) -> Dict[str, Any]:
        """Get full config"""
        return dict(self._data)

    def set_config(self, config: Dict[str, Any]) -> None:
        """Set full config"""
        self._data = dict(config)
        self._save()


def create_storage(storage_type: str, config_path: Optional[str] = None) -> StorageAdapter:
    """Create storage adapter by type"""
    if storage_type == "file":
        return FileStorage(config_path or "./.openrouter-auto.json")
    elif storage_type == "memory":
        return MemoryStorage()
    else:
        raise ValueError(f"Unknown storage type: {storage_type}")


# Storage keys
STORAGE_KEYS = {
    "MODELS": "models",
    "MODEL_CONFIGS": "model_configs",
    "USER_PREFERENCES": "user_preferences",
    "LAST_FETCH": "last_fetch",
}


async def get_stored_models(storage: StorageAdapter) -> list:
    """Get stored models"""
    return await storage.get(STORAGE_KEYS["MODELS"]) or []


async def set_stored_models(storage: StorageAdapter, models: list) -> None:
    """Set stored models"""
    await storage.set(STORAGE_KEYS["MODELS"], models)


async def get_model_configs(storage: StorageAdapter) -> Dict[str, Any]:
    """Get model configs"""
    return await storage.get(STORAGE_KEYS["MODEL_CONFIGS"]) or {}


async def set_model_config(storage: StorageAdapter, model_id: str, config: Any) -> None:
    """Set model config"""
    from .types import ModelConfig

    configs = await get_model_configs(storage)
    if isinstance(config, ModelConfig):
        configs[model_id] = config.to_dict()
    else:
        configs[model_id] = config
    await storage.set(STORAGE_KEYS["MODEL_CONFIGS"], configs)


async def remove_model_config(storage: StorageAdapter, model_id: str) -> None:
    """Remove model config"""
    configs = await get_model_configs(storage)
    if model_id in configs:
        del configs[model_id]
        await storage.set(STORAGE_KEYS["MODEL_CONFIGS"], configs)


async def get_user_preferences(storage: StorageAdapter) -> Optional[Any]:
    """Get user preferences"""
    return await storage.get(STORAGE_KEYS["USER_PREFERENCES"])


async def set_user_preferences(storage: StorageAdapter, preferences: Any) -> None:
    """Set user preferences — strips api_key before persisting."""
    safe = preferences
    if hasattr(preferences, '__dict__'):
        safe_dict = {k: v for k, v in preferences.__dict__.items() if k not in ("api_key", "apiKey")}
        safe = safe_dict
    elif isinstance(preferences, dict):
        safe = {k: v for k, v in preferences.items() if k not in ("api_key", "apiKey")}
    await storage.set(STORAGE_KEYS["USER_PREFERENCES"], safe)


async def get_last_fetch_time(storage: StorageAdapter) -> Optional[int]:
    """Get last fetch time"""
    return await storage.get(STORAGE_KEYS["LAST_FETCH"])


async def set_last_fetch_time(storage: StorageAdapter, timestamp: int) -> None:
    """Set last fetch time"""
    await storage.set(STORAGE_KEYS["LAST_FETCH"], timestamp)

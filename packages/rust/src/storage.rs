use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Trait for key-value storage used by the client.
pub trait Storage: Send + Sync {
    fn get(&self, key: &str) -> Option<serde_json::Value>;
    fn set(&self, key: &str, value: serde_json::Value);
    fn remove(&self, key: &str);
    fn clear(&self);
}

// ── MemoryStorage ───────────────────────────────────────────────────────────

pub struct MemoryStorage {
    store: Mutex<HashMap<String, serde_json::Value>>,
}

impl MemoryStorage {
    pub fn new() -> Self {
        Self {
            store: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for MemoryStorage {
    fn default() -> Self {
        Self::new()
    }
}

impl Storage for MemoryStorage {
    fn get(&self, key: &str) -> Option<serde_json::Value> {
        self.store.lock().unwrap().get(key).cloned()
    }
    fn set(&self, key: &str, value: serde_json::Value) {
        self.store.lock().unwrap().insert(key.to_string(), value);
    }
    fn remove(&self, key: &str) {
        self.store.lock().unwrap().remove(key);
    }
    fn clear(&self) {
        self.store.lock().unwrap().clear();
    }
}

// ── FileStorage ─────────────────────────────────────────────────────────────

/// Persists state to a JSON file with restricted path traversal.
pub struct FileStorage {
    path: PathBuf,
    data: Mutex<HashMap<String, serde_json::Value>>,
}

impl FileStorage {
    /// Create a FileStorage at the given path.
    /// The resolved path must be under `CWD` or `HOME`.
    pub fn new(config_path: Option<&str>) -> Result<Self, String> {
        let raw = config_path.unwrap_or(".openrouter-auto.json");
        let abs = std::fs::canonicalize(raw)
            .or_else(|_| {
                // File may not exist yet; canonicalize the parent.
                let p = Path::new(raw);
                let parent = p.parent().unwrap_or(Path::new("."));
                let parent_abs = std::fs::canonicalize(parent)
                    .map_err(|e| format!("invalid config path: {}", e))?;
                Ok::<PathBuf, String>(parent_abs.join(p.file_name().unwrap_or_default()))
            })
            .map_err(|e| format!("invalid config path: {}", e))?;

        let cwd = std::env::current_dir().unwrap_or_default();
        let home = dirs_path();
        if !is_under(&abs, &cwd) && !is_under(&abs, &home) {
            return Err(format!(
                "configPath {:?} resolves outside CWD and HOME — not allowed to prevent path traversal",
                raw
            ));
        }

        let mut data = HashMap::new();
        if abs.exists() {
            if let Ok(bytes) = std::fs::read(&abs) {
                if let Ok(parsed) = serde_json::from_slice(&bytes) {
                    data = parsed;
                }
            }
        }

        Ok(Self {
            path: abs,
            data: Mutex::new(data),
        })
    }

    fn save(&self) {
        let data = self.data.lock().unwrap();
        if let Ok(bytes) = serde_json::to_vec_pretty(&*data) {
            if let Some(parent) = self.path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&self.path, bytes);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(
                    &self.path,
                    std::fs::Permissions::from_mode(0o600),
                );
            }
        }
    }
}

impl Storage for FileStorage {
    fn get(&self, key: &str) -> Option<serde_json::Value> {
        self.data.lock().unwrap().get(key).cloned()
    }
    fn set(&self, key: &str, value: serde_json::Value) {
        self.data
            .lock()
            .unwrap()
            .insert(key.to_string(), value);
        self.save();
    }
    fn remove(&self, key: &str) {
        self.data.lock().unwrap().remove(key);
        self.save();
    }
    fn clear(&self) {
        self.data.lock().unwrap().clear();
        self.save();
    }
}

fn is_under(path: &Path, base: &Path) -> bool {
    path.starts_with(base)
}

fn dirs_path() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
}

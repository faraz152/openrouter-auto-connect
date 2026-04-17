package openrouterauto

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Storage is the minimal key/value interface used by the client.
type Storage interface {
	Get(key string) (any, bool)
	Set(key string, value any)
	Remove(key string)
	Clear()
}

// ── MemoryStorage ─────────────────────────────────────────────────────────

// MemoryStorage is the default in-process, non-persistent store.
type MemoryStorage struct {
	mu    sync.RWMutex
	store map[string]any
}

// NewMemoryStorage returns an initialised MemoryStorage.
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{store: make(map[string]any)}
}

func (m *MemoryStorage) Get(key string) (any, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.store[key]
	return v, ok
}

func (m *MemoryStorage) Set(key string, value any) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.store[key] = value
}

func (m *MemoryStorage) Remove(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.store, key)
}

func (m *MemoryStorage) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.store = make(map[string]any)
}

// ── FileStorage ───────────────────────────────────────────────────────────

// FileStorage persists state to a JSON file with 0600 permissions.
// The resolved path must fall under CWD or the user's home directory
// to prevent path-traversal attacks.
type FileStorage struct {
	path string
	mu   sync.Mutex
	data map[string]any
}

// NewFileStorage creates a FileStorage at configPath.
// Returns an error when the path resolves outside CWD / HOME.
func NewFileStorage(configPath string) (*FileStorage, error) {
	if configPath == "" {
		configPath = ".openrouter-auto.json"
	}
	abs, err := filepath.Abs(configPath)
	if err != nil {
		return nil, fmt.Errorf("invalid config path: %w", err)
	}
	cwd, _ := os.Getwd()
	home, _ := os.UserHomeDir()
	if !isUnder(abs, cwd) && !isUnder(abs, home) {
		return nil, fmt.Errorf(
			"configPath %q resolves outside CWD and HOME — not allowed to prevent path traversal",
			configPath,
		)
	}
	fs := &FileStorage{path: abs, data: make(map[string]any)}
	_ = fs.load()
	return fs, nil
}

// isUnder reports whether path is equal to or nested inside base.
func isUnder(path, base string) bool {
	rel, err := filepath.Rel(base, path)
	if err != nil {
		return false
	}
	// If rel starts with ".." the path is outside base.
	return len(rel) >= 2 && rel[:2] != ".." || rel == "."
}

func (f *FileStorage) Get(key string) (any, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.data[key]
	return v, ok
}

func (f *FileStorage) Set(key string, value any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.data[key] = value
	_ = f.save()
}

func (f *FileStorage) Remove(key string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.data, key)
	_ = f.save()
}

func (f *FileStorage) Clear() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.data = make(map[string]any)
	_ = f.save()
}

func (f *FileStorage) load() error {
	b, err := os.ReadFile(f.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, &f.data)
}

func (f *FileStorage) save() error {
	b, err := json.MarshalIndent(f.data, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f.path), 0700); err != nil {
		return err
	}
	return os.WriteFile(f.path, b, 0600)
}

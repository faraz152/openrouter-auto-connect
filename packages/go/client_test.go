package openrouterauto_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	ora "github.com/faraz152/openrouter-auto-connect/go"
)

// ── helpers ─────────────────────────────────────────────────────────────────

func newTestClient(t *testing.T, srv *httptest.Server) *ora.Client {
	t.Helper()
	c, err := ora.NewClient(ora.Options{
		APIKey:  "test-key",
		BaseURL: srv.URL,
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

func modelsHandler(models []ora.Model) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"data": models})
	}
}

func chatHandler(content string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := ora.ChatResponse{
			ID:    "chatcmpl-test",
			Model: "test-model",
			Choices: []ora.ChatChoice{
				{Index: 0, Message: ora.ChatMessage{Role: "assistant", Content: content}},
			},
			Usage: ora.ChatUsage{PromptTokens: 5, CompletionTokens: 3, TotalTokens: 8},
		}
		json.NewEncoder(w).Encode(resp)
	}
}

// ── NewClient ────────────────────────────────────────────────────────────────

func TestNewClient_MissingAPIKey(t *testing.T) {
	_, err := ora.NewClient(ora.Options{})
	if err == nil {
		t.Fatal("expected error for missing API key")
	}
}

func TestNewClient_BadScheme(t *testing.T) {
	_, err := ora.NewClient(ora.Options{APIKey: "k", BaseURL: "ftp://example.com"})
	if err == nil {
		t.Fatal("expected error for unsupported scheme")
	}
}

// ── FetchModels ──────────────────────────────────────────────────────────────

func TestFetchModels(t *testing.T) {
	models := []ora.Model{
		{ID: "openai/gpt-4o", Name: "GPT-4o"},
		{ID: "anthropic/claude-3-5-sonnet:free", Name: "Claude 3.5 Sonnet (free)"},
	}
	srv := httptest.NewServer(modelsHandler(models))
	defer srv.Close()

	c := newTestClient(t, srv)
	got, err := c.FetchModels()
	if err != nil {
		t.Fatalf("FetchModels: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 models, got %d", len(got))
	}
	if got[0].ID != "openai/gpt-4o" {
		t.Errorf("unexpected first model: %s", got[0].ID)
	}
}

func TestFetchModels_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"Unauthorized"}}`, http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	_, err := c.FetchModels()
	if err == nil {
		t.Fatal("expected error for 401 response")
	}
	oraErr, ok := err.(*ora.ORAError)
	if !ok {
		t.Fatalf("expected *ORAError, got %T", err)
	}
	if oraErr.Code != ora.ErrInvalidAPIKey {
		t.Errorf("expected ErrInvalidAPIKey, got %s", oraErr.Code)
	}
}

// ── Chat ─────────────────────────────────────────────────────────────────────

func TestChat(t *testing.T) {
	srv := httptest.NewServer(chatHandler("Hello!"))
	defer srv.Close()

	c := newTestClient(t, srv)
	resp, err := c.Chat(ora.ChatRequest{
		Model:    "test-model",
		Messages: []ora.ChatMessage{{Role: "user", Content: "Hi"}},
	})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if resp.Content() != "Hello!" {
		t.Errorf("unexpected content: %q", resp.Content())
	}
}

func TestChat_RateLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"rate limit exceeded"}}`, http.StatusTooManyRequests)
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	_, err := c.Chat(ora.ChatRequest{
		Model:    "test-model",
		Messages: []ora.ChatMessage{{Role: "user", Content: "Hi"}},
	})
	oraErr, ok := err.(*ora.ORAError)
	if !ok {
		t.Fatalf("expected *ORAError, got %T", err)
	}
	if oraErr.Code != ora.ErrRateLimited {
		t.Errorf("expected ErrRateLimited, got %s", oraErr.Code)
	}
	if !oraErr.Retryable {
		t.Error("rate-limit error should be retryable")
	}
}

// ── IsFreeModel / GetPriceTier ───────────────────────────────────────────────

func TestIsFreeModel(t *testing.T) {
	free := ora.Model{ID: "vendor/model:free", Pricing: ora.ModelPricing{Prompt: "0", Completion: "0"}}
	if !ora.IsFreeModel(free) {
		t.Error("model with :free suffix should be free")
	}
	paid := ora.Model{ID: "vendor/model", Pricing: ora.ModelPricing{Prompt: "0.001", Completion: "0.002"}}
	if ora.IsFreeModel(paid) {
		t.Error("paid model should not be free")
	}
}

func TestGetPriceTier(t *testing.T) {
	free := ora.Model{ID: "a:free"}
	if tier := ora.GetPriceTier(free); tier != "free" {
		t.Errorf("expected free, got %s", tier)
	}
	expensive := ora.Model{ID: "a", Pricing: ora.ModelPricing{Prompt: "0.1", Completion: "0.1"}}
	if tier := ora.GetPriceTier(expensive); tier != "expensive" {
		t.Errorf("expected expensive, got %s", tier)
	}
}

// ── CalculateCost ────────────────────────────────────────────────────────────

func TestCalculateCost(t *testing.T) {
	model := ora.Model{
		ID:      "vendor/model",
		Pricing: ora.ModelPricing{Prompt: "0.001", Completion: "0.002"},
	}
	est := ora.CalculateCost(model, 1000, 500)
	wantPrompt := 0.001
	wantCompletion := 0.001
	if est.PromptCost != wantPrompt {
		t.Errorf("PromptCost: got %f, want %f", est.PromptCost, wantPrompt)
	}
	if est.CompletionCost != wantCompletion {
		t.Errorf("CompletionCost: got %f, want %f", est.CompletionCost, wantCompletion)
	}
	if est.TotalCost != est.PromptCost+est.CompletionCost {
		t.Errorf("TotalCost mismatch")
	}
}

// ── EstimateTokens ───────────────────────────────────────────────────────────

func TestEstimateTokens(t *testing.T) {
	// 4 chars/token → "test" (4 chars) → 1 token
	n := ora.EstimateTokens("test")
	if n != 1 {
		t.Errorf("expected 1 token, got %d", n)
	}
	if ora.EstimateTokens("") != 0 {
		t.Error("empty string should have 0 tokens")
	}
}

// ── ValidateParameters ───────────────────────────────────────────────────────

func TestValidateParameters(t *testing.T) {
	model := ora.Model{
		ID:                  "test/model",
		SupportedParameters: []string{"temperature", "max_tokens"},
	}
	// Valid
	errs := ora.ValidateParameters(model, map[string]any{"temperature": 0.7})
	if len(errs) != 0 {
		t.Errorf("expected no errors, got: %v", errs)
	}
	// Out of range
	errs = ora.ValidateParameters(model, map[string]any{"temperature": 5.0})
	if len(errs) == 0 {
		t.Error("expected error for temperature=5.0 (out of range)")
	}
	// Unsupported param
	errs = ora.ValidateParameters(model, map[string]any{"unknown_param": 1})
	if len(errs) == 0 {
		t.Error("expected error for unsupported param")
	}
}

// ── MemoryStorage ────────────────────────────────────────────────────────────

func TestMemoryStorage(t *testing.T) {
	s := ora.NewMemoryStorage()
	s.Set("key1", "value1")
	v, ok := s.Get("key1")
	if !ok || v != "value1" {
		t.Errorf("Get after Set: got (%v, %v)", v, ok)
	}
	s.Remove("key1")
	_, ok = s.Get("key1")
	if ok {
		t.Error("key should be removed")
	}
	s.Set("a", 1)
	s.Set("b", 2)
	s.Clear()
	_, ok = s.Get("a")
	if ok {
		t.Error("Clear should remove all keys")
	}
}

// ── AddModel ─────────────────────────────────────────────────────────────────

func TestAddModel_SkipTest(t *testing.T) {
	srv := httptest.NewServer(chatHandler("Hi"))
	defer srv.Close()

	c := newTestClient(t, srv)
	cfg, err := c.AddModel("openai/gpt-4o", map[string]any{"temperature": 0.5}, true)
	if err != nil {
		t.Fatalf("AddModel: %v", err)
	}
	if cfg.ModelID != "openai/gpt-4o" {
		t.Errorf("unexpected model ID: %s", cfg.ModelID)
	}
	if cfg.TestStatus != "unknown" {
		t.Errorf("expected unknown status when skipTest=true, got %s", cfg.TestStatus)
	}
}

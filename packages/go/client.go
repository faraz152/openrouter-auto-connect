package openrouterauto

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultBaseURL  = "https://openrouter.ai/api/v1"
	defaultSiteURL  = "https://github.com/faraz152/openrouter-auto-connect"
	defaultSiteName = "openrouter-auto-connect"
)

// Client is the main SDK entry point for the OpenRouter API.
type Client struct {
	apiKey        string
	baseURL       string
	httpCli       *http.Client
	headers       map[string]string
	Storage       Storage
	models        []Model
	configs       map[string]ModelConfig
	onEvent       func(Event)
	onError       func(*ORAError)
	eventHandlers map[string][]EventHandler
}

// NewClient creates a Client from Options.
// Returns an error when APIKey is empty or the BaseURL scheme is not http/https.
func NewClient(opts Options) (*Client, error) {
	if opts.APIKey == "" {
		return nil, &ORAError{
			Code:    ErrInvalidAPIKey,
			Message: errs.Messages[ErrInvalidAPIKey],
		}
	}
	base := opts.BaseURL
	if base == "" {
		base = defaultBaseURL
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return nil, fmt.Errorf("unsupported base URL scheme in %q: only https:// and http:// are allowed", base)
	}

	siteURL := opts.SiteURL
	if siteURL == "" {
		siteURL = defaultSiteURL
	}
	siteName := opts.SiteName
	if siteName == "" {
		siteName = defaultSiteName
	}

	var store Storage
	switch strings.ToLower(opts.StorageType) {
	case "file":
		fs, err := NewFileStorage(opts.ConfigPath)
		if err != nil {
			return nil, err
		}
		store = fs
	default:
		store = NewMemoryStorage()
	}

	return &Client{
		apiKey:  opts.APIKey,
		baseURL: strings.TrimRight(base, "/"),
		httpCli: &http.Client{Timeout: 60 * time.Second},
		headers: map[string]string{
			"Content-Type": "application/json",
			"HTTP-Referer": siteURL,
			"X-Title":      siteName,
		},
		Storage:       store,
		configs:       make(map[string]ModelConfig),
		onEvent:       opts.OnEvent,
		onError:       opts.OnError,
		eventHandlers: make(map[string][]EventHandler),
	}, nil
}

// doRequest executes an HTTP request with the API key injected per-request.
// The key is never stored in http.Client default headers.
func (c *Client) doRequest(method, path string, body []byte) ([]byte, *http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, nil, &ORAError{Code: ErrNetworkError, Message: err.Error(), Retryable: false}
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	// Per-request auth — keeps the API key out of the shared transport.
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return nil, nil, newNetworkError(err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp, newNetworkError(err)
	}
	return respBody, resp, nil
}

// FetchModels retrieves all available models from the OpenRouter API
// and caches them on the client.
func (c *Client) FetchModels() ([]Model, error) {
	body, resp, err := c.doRequest("GET", "/models", nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, parseHTTPError(resp, body)
	}
	var result struct {
		Data []Model `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, &ORAError{Code: ErrUnknown, Message: "failed to parse models response"}
	}
	c.models = result.Data
	c.emit("models:updated", map[string]any{"count": len(c.models)})
	return c.models, nil
}

// GetModels returns the cached model slice (empty until FetchModels is called).
func (c *Client) GetModels() []Model {
	return c.models
}

// GetModel looks up a single cached model by ID.
func (c *Client) GetModel(id string) (Model, bool) {
	for _, m := range c.models {
		if m.ID == id {
			return m, true
		}
	}
	return Model{}, false
}

// AddModel creates a ModelConfig entry, optionally verifying connectivity first.
func (c *Client) AddModel(modelID string, params map[string]any, skipTest bool) (*ModelConfig, error) {
	// Validate parameters against the model definition, if the model is known.
	if m, ok := c.GetModel(modelID); ok {
		if errs := ValidateParameters(m, params); len(errs) > 0 {
			return nil, &ORAError{Code: ErrInvalidParameters, Message: fmt.Sprintf("invalid parameters: %v", errs)}
		}
	}
	cfg := ModelConfig{
		ModelID:    modelID,
		Parameters: params,
		Enabled:    true,
		TestStatus: "unknown",
	}
	if !skipTest {
		available, errMsg, _ := c.CheckModelAvailability(modelID)
		if available {
			cfg.TestStatus = "success"
		} else {
			cfg.TestStatus = "failed"
			cfg.TestError = errMsg
		}
	}
	c.configs[modelID] = cfg
	return &cfg, nil
}

// GetModelConfig returns the config for a model, if it exists.
func (c *Client) GetModelConfig(modelID string) (ModelConfig, bool) {
	cfg, ok := c.configs[modelID]
	return cfg, ok
}

// Chat sends a single (non-streaming) request to POST /chat/completions.
func (c *Client) Chat(req ChatRequest) (*ChatResponse, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, &ORAError{Code: ErrInvalidParameters, Message: "failed to serialise request"}
	}
	body, resp, err := c.doRequest("POST", "/chat/completions", payload)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, parseHTTPError(resp, body)
	}
	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, &ORAError{Code: ErrUnknown, Message: "failed to parse chat response"}
	}
	return &chatResp, nil
}

// CheckModelAvailability sends a minimal test prompt to verify a model is reachable.
// Returns (available, errorMessage, responseTimeMs).
func (c *Client) CheckModelAvailability(modelID string) (bool, string, float64) {
	testReq := ChatRequest{
		Model: modelID,
		Messages: []ChatMessage{
			{Role: "user", Content: `Say "Hello!" and nothing else.`},
		},
		MaxTokens: 10,
	}
	start := time.Now()
	_, err := c.Chat(testReq)
	elapsed := float64(time.Since(start).Milliseconds())
	if err != nil {
		return false, err.Error(), elapsed
	}
	return true, "", elapsed
}

// FilterModels returns the subset of cached models matching the given options.
// Call FetchModels first to populate the cache.
func (c *Client) FilterModels(opts ModelFilterOptions) []Model {
	var out []Model
	for _, m := range c.models {
		// Modality
		if opts.Modality != "" && m.Architecture.Modality != opts.Modality {
			continue
		}
		// Input modalities
		if len(opts.InputModalities) > 0 {
			if !allIn(opts.InputModalities, m.Architecture.InputModalities) {
				continue
			}
		}
		// Output modalities
		if len(opts.OutputModalities) > 0 {
			if !allIn(opts.OutputModalities, m.Architecture.OutputModalities) {
				continue
			}
		}
		// Max price
		if opts.HasMaxPrice {
			pp := parseModelPrice(m.Pricing.Prompt)
			cp := parseModelPrice(m.Pricing.Completion)
			if pp > opts.MaxPrice || cp > opts.MaxPrice {
				continue
			}
		}
		// Context length
		if opts.MinContextLength > 0 && m.ContextLength < opts.MinContextLength {
			continue
		}
		if opts.MaxContextLength > 0 && m.ContextLength > opts.MaxContextLength {
			continue
		}
		// Provider
		if opts.Provider != "" {
			if idx := strings.Index(m.ID, "/"); idx < 0 || m.ID[:idx] != opts.Provider {
				continue
			}
		}
		// Search
		if opts.Search != "" {
			q := strings.ToLower(opts.Search)
			if !strings.Contains(strings.ToLower(m.ID), q) &&
				!strings.Contains(strings.ToLower(m.Name), q) &&
				!strings.Contains(strings.ToLower(m.Description), q) {
				continue
			}
		}
		// Supported parameters
		if len(opts.SupportedParameters) > 0 {
			if !allIn(opts.SupportedParameters, m.SupportedParameters) {
				continue
			}
		}
		// Exclude list
		if containsStr(opts.ExcludeModels, m.ID) {
			continue
		}
		// Free only
		if opts.FreeOnly {
			if parseModelPrice(m.Pricing.Prompt) > 0 || parseModelPrice(m.Pricing.Completion) > 0 {
				continue
			}
		}
		// Price tier
		if opts.PriceTier != "" && GetPriceTier(m) != opts.PriceTier {
			continue
		}
		out = append(out, m)
	}
	return out
}

// StreamChat sends a streaming chat request and returns a channel of chunks plus
// an error channel. The caller should drain both channels. The error channel
// receives at most one value and is closed when streaming finishes.
//
//	ch, errCh := client.StreamChat(req)
//	acc := &ora.StreamAccumulator{}
//	for chunk := range ch {
//	    acc.Push(chunk)
//	}
//	if err := <-errCh; err != nil { ... }
func (c *Client) StreamChat(req ChatRequest) (<-chan StreamChunk, <-chan error) {
	ch := make(chan StreamChunk, 32)
	errCh := make(chan error, 1)

	req.Stream = true
	payload, err := json.Marshal(req)
	if err != nil {
		close(ch)
		errCh <- &ORAError{Code: ErrInvalidParameters, Message: "failed to serialise request"}
		close(errCh)
		return ch, errCh
	}

	go func() {
		defer close(ch)
		defer close(errCh)

		httpReq, err := http.NewRequest("POST", c.baseURL+"/chat/completions", bytes.NewReader(payload))
		if err != nil {
			errCh <- newNetworkError(err)
			return
		}
		for k, v := range c.headers {
			httpReq.Header.Set(k, v)
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("Accept", "text/event-stream")

		resp, err := c.httpCli.Do(httpReq)
		if err != nil {
			errCh <- newNetworkError(err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			errCh <- parseHTTPError(resp, body)
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := line[6:]
			if data == "[DONE]" {
				break
			}
			var chunk StreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err == nil {
				ch <- chunk
			}
		}
		if err := scanner.Err(); err != nil {
			errCh <- newNetworkError(err)
		}
	}()

	return ch, errCh
}

// ── Event system ─────────────────────────────────────────────────────────────

// On registers an event handler for the given event type and returns an
// unsubscribe function.
func (c *Client) On(eventType string, handler EventHandler) func() {
	c.eventHandlers[eventType] = append(c.eventHandlers[eventType], handler)
	return func() {
		handlers := c.eventHandlers[eventType]
		for i, h := range handlers {
			// Compare function pointers via fmt.Sprintf — sufficient for dedup.
			if fmt.Sprintf("%p", h) == fmt.Sprintf("%p", handler) {
				c.eventHandlers[eventType] = append(handlers[:i], handlers[i+1:]...)
				return
			}
		}
	}
}

func (c *Client) emit(eventType string, payload any) {
	e := Event{Type: eventType, Payload: payload}
	if c.onEvent != nil {
		c.onEvent(e)
	}
	for _, h := range c.eventHandlers[eventType] {
		h(e)
	}
}

func (c *Client) handleError(err *ORAError) {
	if c.onError != nil {
		c.onError(err)
	}
	c.emit("error", err)
}

// ── Web search helpers ────────────────────────────────────────────────────────

// WebSearchParams holds optional configuration for the web search tool.
type WebSearchParams struct {
	MaxResults   int    `json:"max_results,omitempty"`
	SearchPrompt string `json:"search_prompt,omitempty"`
}

// CreateWebSearchTool builds a server-tool entry for OpenRouter's built-in
// web search. Pass nil for default parameters.
//
//	req.Tools = append(req.Tools, ora.CreateWebSearchTool(nil))
func CreateWebSearchTool(params *WebSearchParams) map[string]any {
	tool := map[string]any{"type": "openrouter:web_search"}
	if params != nil {
		tool["parameters"] = params
	}
	return tool
}

// EnableWebSearch returns a copy of req with the web search tool appended to
// its Tools slice.
func EnableWebSearch(req ChatRequest, params *WebSearchParams) ChatRequest {
	tools := make([]any, len(req.Tools))
	copy(tools, req.Tools)
	tools = append(tools, CreateWebSearchTool(params))
	req.Tools = tools
	return req
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func allIn(needles, haystack []string) bool {
	set := make(map[string]struct{}, len(haystack))
	for _, s := range haystack {
		set[s] = struct{}{}
	}
	for _, n := range needles {
		if _, ok := set[n]; !ok {
			return false
		}
	}
	return true
}

func containsStr(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func parseModelPrice(s string) float64 {
	var v float64
	fmt.Sscanf(s, "%f", &v)
	return v
}

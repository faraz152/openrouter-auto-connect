package openrouterauto

import (
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
	apiKey  string
	baseURL string
	httpCli *http.Client
	headers map[string]string
	Storage Storage
	models  []Model
	configs map[string]ModelConfig
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
		Storage: store,
		configs: make(map[string]ModelConfig),
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

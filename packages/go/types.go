package openrouterauto

// ModelArchitecture describes the input/output modalities of a model.
type ModelArchitecture struct {
	Modality         string   `json:"modality"`
	InputModalities  []string `json:"input_modalities"`
	OutputModalities []string `json:"output_modalities"`
	InstructType     string   `json:"instruct_type,omitempty"`
	Tokenizer        string   `json:"tokenizer,omitempty"`
}

// ModelPricing holds per-token prices as strings (matching API format).
type ModelPricing struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
	Image      string `json:"image"`
	Request    string `json:"request"`
}

// TopProvider holds provider-specific limits.
type TopProvider struct {
	ContextLength       int  `json:"context_length"`
	MaxCompletionTokens int  `json:"max_completion_tokens"`
	IsModerated         bool `json:"is_moderated"`
}

// Model is a single model entry from the OpenRouter /models API.
type Model struct {
	ID                  string            `json:"id"`
	Name                string            `json:"name"`
	Description         string            `json:"description,omitempty"`
	ContextLength       int               `json:"context_length"`
	Created             int64             `json:"created"`
	Architecture        ModelArchitecture `json:"architecture"`
	Pricing             ModelPricing      `json:"pricing"`
	SupportedParameters []string          `json:"supported_parameters"`
	TopProvider         TopProvider       `json:"top_provider"`
}

// ChatMessage is a single turn in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

// ChatRequest is the body sent to POST /chat/completions.
type ChatRequest struct {
	Model       string         `json:"model"`
	Messages    []ChatMessage  `json:"messages"`
	MaxTokens   int            `json:"max_tokens,omitempty"`
	Temperature float64        `json:"temperature,omitempty"`
	Stream      bool           `json:"stream,omitempty"`
}

// ChatUsage reports token consumption.
type ChatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ChatChoice is one choice in the response.
type ChatChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// ChatResponse is the full response from POST /chat/completions.
type ChatResponse struct {
	ID      string       `json:"id"`
	Model   string       `json:"model"`
	Choices []ChatChoice `json:"choices"`
	Usage   ChatUsage    `json:"usage"`
	Created int64        `json:"created"`
}

// Content returns the text of the first choice, or an empty string.
func (r *ChatResponse) Content() string {
	if len(r.Choices) == 0 {
		return ""
	}
	return r.Choices[0].Message.Content
}

// ModelConfig holds the user's persisted parameter overrides for a model.
type ModelConfig struct {
	ModelID    string         `json:"model_id"`
	Parameters map[string]any `json:"parameters"`
	Enabled    bool           `json:"enabled"`
	TestStatus string         `json:"test_status,omitempty"` // "success" | "failed" | "unknown"
	TestError  string         `json:"test_error,omitempty"`
}

// CostEstimate breaks down the cost of a single request.
type CostEstimate struct {
	PromptCost     float64 `json:"prompt_cost"`
	CompletionCost float64 `json:"completion_cost"`
	ReasoningCost  float64 `json:"reasoning_cost"`
	TotalCost      float64 `json:"total_cost"`
	Currency       string  `json:"currency"`
}

// Options configures the SDK client.
type Options struct {
	APIKey      string // required
	BaseURL     string // default: "https://openrouter.ai/api/v1"
	SiteURL     string // HTTP-Referer header
	SiteName    string // X-Title header
	StorageType string // "memory" | "file" (default: "memory")
	ConfigPath  string // path for file storage (used when StorageType is "file")
}

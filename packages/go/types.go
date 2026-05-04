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
	Role             string `json:"role"` // "system" | "user" | "assistant" | "tool"
	Content          string `json:"content"`
	Name             string `json:"name,omitempty"`
	ToolCallID       string `json:"tool_call_id,omitempty"`
	Reasoning        string `json:"reasoning,omitempty"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// ChatRequest is the body sent to POST /chat/completions.
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	Tools       []any         `json:"tools,omitempty"`
	ToolChoice  any           `json:"tool_choice,omitempty"`
	Reasoning   any           `json:"reasoning,omitempty"`
	Provider    any           `json:"provider,omitempty"`
}

// StreamDelta is the delta payload inside a streaming choice.
type StreamDelta struct {
	Role             string `json:"role,omitempty"`
	Content          string `json:"content,omitempty"`
	Reasoning        string `json:"reasoning,omitempty"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// StreamChoice is one choice in a streaming chunk.
type StreamChoice struct {
	Index        int         `json:"index"`
	Delta        StreamDelta `json:"delta"`
	FinishReason string      `json:"finish_reason,omitempty"`
}

// StreamChunk is a single SSE data object from a streaming response.
type StreamChunk struct {
	ID      string         `json:"id"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
	Usage   *ChatUsage     `json:"usage,omitempty"`
	Created int64          `json:"created"`
}

// StreamAccumulator collects streaming chunks into a complete response.
// Use it when consuming StreamChat.
//
//	ch, errCh := client.StreamChat(req)
//	acc := &ora.StreamAccumulator{}
//	for chunk := range ch {
//	    acc.Push(chunk)
//	    fmt.Print(acc.Content)
//	}
//	resp := acc.ToResponse()
type StreamAccumulator struct {
	Content      string
	Reasoning    string
	FinishReason string
	id           string
	model        string
	created      int64
	usage        *ChatUsage
}

// Push incorporates one streaming chunk into the accumulator.
func (a *StreamAccumulator) Push(chunk StreamChunk) {
	if chunk.ID != "" {
		a.id = chunk.ID
	}
	if chunk.Model != "" {
		a.model = chunk.Model
	}
	if chunk.Created != 0 {
		a.created = chunk.Created
	}
	if chunk.Usage != nil {
		a.usage = chunk.Usage
	}
	if len(chunk.Choices) == 0 {
		return
	}
	choice := chunk.Choices[0]
	if choice.FinishReason != "" {
		a.FinishReason = choice.FinishReason
	}
	a.Content += choice.Delta.Content
	a.Reasoning += choice.Delta.Reasoning
	a.Reasoning += choice.Delta.ReasoningContent
}

// ToResponse converts the accumulated state into a ChatResponse.
func (a *StreamAccumulator) ToResponse() *ChatResponse {
	msg := ChatMessage{Role: "assistant", Content: a.Content}
	if a.Reasoning != "" {
		msg.Reasoning = a.Reasoning
	}
	resp := &ChatResponse{
		ID:      a.id,
		Model:   a.model,
		Created: a.created,
		Choices: []ChatChoice{{Index: 0, Message: msg, FinishReason: a.FinishReason}},
	}
	if a.usage != nil {
		resp.Usage = *a.usage
	}
	return resp
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
	APIKey      string          // required
	BaseURL     string          // default: "https://openrouter.ai/api/v1"
	SiteURL     string          // HTTP-Referer header
	SiteName    string          // X-Title header
	StorageType string          // "memory" | "file" (default: "memory")
	ConfigPath  string          // path for file storage (used when StorageType is "file")
	OnEvent     func(Event)     // optional global event handler
	OnError     func(*ORAError) // optional global error handler
}

// ModelFilterOptions controls which models FilterModels returns.
type ModelFilterOptions struct {
	Modality            string   // e.g. "text->text"
	InputModalities     []string // required input modalities
	OutputModalities    []string // required output modalities
	MaxPrice            float64  // max per-token price; 0 means no limit
	HasMaxPrice         bool     // set to true when MaxPrice should be applied
	MinContextLength    int
	MaxContextLength    int
	Provider            string // prefix before the first "/"
	Search              string // substring match on ID / Name / Description
	SupportedParameters []string
	ExcludeModels       []string
	FreeOnly            bool
	PriceTier           string // "free" | "cheap" | "moderate" | "expensive"
}

// Event is emitted by the SDK for state changes and errors.
type Event struct {
	Type    string
	Payload any
}

// EventHandler is a function that receives SDK events.
type EventHandler func(Event)

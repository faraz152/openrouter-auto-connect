use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Model types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelArchitecture {
    pub modality: String,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    #[serde(default)]
    pub instruct_type: Option<String>,
    #[serde(default)]
    pub tokenizer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub completion: String,
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub request: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopProvider {
    pub context_length: i64,
    pub max_completion_tokens: i64,
    pub is_moderated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub context_length: i64,
    pub created: i64,
    pub architecture: ModelArchitecture,
    pub pricing: ModelPricing,
    #[serde(default)]
    pub supported_parameters: Vec<String>,
    pub top_provider: TopProvider,
}

// ── Chat types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_details: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refusal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<Vec<serde_json::Value>>,
}

impl ChatMessage {
    /// Create a simple text message.
    pub fn new(role: &str, content: &str) -> Self {
        Self {
            role: role.to_string(),
            content: Some(serde_json::Value::String(content.to_string())),
            name: None,
            tool_calls: None,
            tool_call_id: None,
            reasoning: None,
            reasoning_content: None,
            reasoning_details: None,
            refusal: None,
            annotations: None,
        }
    }

    /// Return content as a string, if it is one.
    pub fn content_str(&self) -> &str {
        match &self.content {
            Some(serde_json::Value::String(s)) => s.as_str(),
            _ => "",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_completion_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repetition_penalty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_a: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parallel_tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugins: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modalities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_logprobs: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_control: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_tier: Option<String>,
}

impl ChatRequest {
    /// Create a minimal chat request.
    pub fn new(model: &str, messages: Vec<ChatMessage>) -> Self {
        Self {
            model: model.to_string(),
            messages,
            max_tokens: None,
            temperature: None,
            top_p: None,
            top_k: None,
            max_completion_tokens: None,
            frequency_penalty: None,
            presence_penalty: None,
            repetition_penalty: None,
            min_p: None,
            top_a: None,
            seed: None,
            stop: None,
            stream: None,
            stream_options: None,
            tools: None,
            tool_choice: None,
            parallel_tool_calls: None,
            reasoning: None,
            include: None,
            response_format: None,
            provider: None,
            models: None,
            route: None,
            plugins: None,
            metadata: None,
            trace: None,
            session_id: None,
            user: None,
            modalities: None,
            logprobs: None,
            top_logprobs: None,
            cache_control: None,
            service_tier: None,
        }
    }
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub total_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub index: i64,
    pub message: ChatMessage,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: String,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    #[serde(default)]
    pub usage: Option<ChatUsage>,
    #[serde(default)]
    pub created: i64,
}

impl ChatResponse {
    /// Return the text content of the first choice, or empty string.
    pub fn content(&self) -> &str {
        self.choices
            .first()
            .map(|c| c.message.content_str())
            .unwrap_or("")
    }
}

// ── Config types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub model_id: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub enabled: bool,
    #[serde(default)]
    pub test_status: Option<String>,
    #[serde(default)]
    pub test_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimate {
    pub prompt_cost: f64,
    pub completion_cost: f64,
    #[serde(default)]
    pub reasoning_cost: f64,
    pub total_cost: f64,
    pub currency: String,
}

// ── SDK options ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Options {
    pub api_key: String,
    pub base_url: Option<String>,
    pub site_url: Option<String>,
    pub site_name: Option<String>,
    pub storage_type: Option<String>,
    pub config_path: Option<String>,
}

// ── Filter options ───────────────────────────────────────────────────────────

/// Criteria for [`Client::filter_models`].
#[derive(Debug, Clone, Default)]
pub struct ModelFilterOptions {
    pub modality: Option<String>,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    /// When `Some`, models with a per-token price above this value are excluded.
    pub max_price: Option<f64>,
    pub min_context_length: Option<i64>,
    pub max_context_length: Option<i64>,
    pub provider: Option<String>,
    pub search: Option<String>,
    pub supported_parameters: Vec<String>,
    pub exclude_models: Vec<String>,
    pub free_only: bool,
    /// "free" | "cheap" | "moderate" | "expensive"
    pub price_tier: Option<String>,
}

// ── Streaming types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StreamDelta {
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub reasoning: Option<String>,
    #[serde(default)]
    pub reasoning_content: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChoice {
    pub index: i64,
    pub delta: StreamDelta,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub choices: Vec<StreamChoice>,
    #[serde(default)]
    pub usage: Option<ChatUsage>,
    #[serde(default)]
    pub created: i64,
}

/// Accumulates streaming chunks into a complete [`ChatResponse`].
///
/// # Example
///
/// ```no_run
/// // let mut acc = StreamAccumulator::default();
/// // while let Some(chunk) = stream.recv().await {
/// //     acc.push(chunk);
/// // }
/// // let response = acc.to_response();
/// ```
#[derive(Debug, Clone, Default)]
pub struct StreamAccumulator {
    pub content: String,
    pub reasoning: String,
    pub finish_reason: String,
    id: String,
    model: String,
    created: i64,
    usage: Option<ChatUsage>,
}

impl StreamAccumulator {
    /// Push one streaming chunk into the accumulator.
    pub fn push(&mut self, chunk: StreamChunk) {
        if !chunk.id.is_empty() { self.id = chunk.id.clone(); }
        if !chunk.model.is_empty() { self.model = chunk.model.clone(); }
        if chunk.created != 0 { self.created = chunk.created; }
        if chunk.usage.is_some() { self.usage = chunk.usage.clone(); }

        if let Some(choice) = chunk.choices.first() {
            if let Some(fr) = &choice.finish_reason {
                if !fr.is_empty() { self.finish_reason = fr.clone(); }
            }
            let d = &choice.delta;
            if let Some(c) = &d.content { self.content.push_str(c); }
            if let Some(r) = &d.reasoning { self.reasoning.push_str(r); }
            if let Some(r) = &d.reasoning_content { self.reasoning.push_str(r); }
        }
    }

    /// Convert accumulated state into a [`ChatResponse`].
    pub fn to_response(&self) -> ChatResponse {
        let msg = ChatMessage {
            role: "assistant".to_string(),
            content: Some(serde_json::Value::String(self.content.clone())),
            reasoning: if self.reasoning.is_empty() { None } else { Some(self.reasoning.clone()) },
            ..Default::default()
        };
        ChatResponse {
            id: self.id.clone(),
            model: self.model.clone(),
            created: self.created,
            choices: vec![ChatChoice {
                index: 0,
                message: msg,
                finish_reason: if self.finish_reason.is_empty() { None } else { Some(self.finish_reason.clone()) },
            }],
            usage: self.usage.clone(),
        }
    }
}

// ── Events ───────────────────────────────────────────────────────────────────

/// An event emitted by the SDK.
#[derive(Debug, Clone)]
pub struct Event {
    pub event_type: String,
    pub payload: serde_json::Value,
}

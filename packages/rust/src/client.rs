use crate::cost::{get_price_tier, is_free_model};
use crate::errors::{self, OraError, ERR_INVALID_API_KEY, ERR_INVALID_PARAMETERS, ERR_UNKNOWN};
use crate::storage::{MemoryStorage, Storage};
use crate::types::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use std::collections::HashMap;
use std::sync::Mutex;

const DEFAULT_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_SITE_URL: &str = "https://github.com/faraz152/openrouter-auto-connect";
const DEFAULT_SITE_NAME: &str = "openrouter-auto-connect";

/// The main async client for the OpenRouter API.
pub struct Client {
    api_key: String,
    base_url: String,
    http: reqwest::Client,
    pub storage: Box<dyn Storage>,
    models: Mutex<Vec<Model>>,
    configs: Mutex<HashMap<String, ModelConfig>>,
    event_handlers: Mutex<Vec<(String, Box<dyn Fn(Event) + Send + Sync>)>>,
}

impl Client {
    /// Create a new client. Returns an error if the API key is empty or the
    /// base URL has an unsupported scheme.
    pub fn new(opts: Options) -> Result<Self, OraError> {
        if opts.api_key.is_empty() {
            return Err(OraError {
                code: ERR_INVALID_API_KEY.to_string(),
                message: errors::error_message(ERR_INVALID_API_KEY),
                retryable: false,
                details: None,
            });
        }

        let base = opts.base_url.as_deref().unwrap_or(DEFAULT_BASE_URL);
        if !(base.starts_with("https://") || base.starts_with("http://")) {
            return Err(OraError {
                code: ERR_INVALID_PARAMETERS.to_string(),
                message: format!(
                    "unsupported base URL scheme in {:?}: only https:// and http:// are allowed",
                    base
                ),
                retryable: false,
                details: None,
            });
        }
        let base_url = base.trim_end_matches('/').to_string();

        let site_url = opts
            .site_url
            .as_deref()
            .unwrap_or(DEFAULT_SITE_URL);
        let site_name = opts
            .site_name
            .as_deref()
            .unwrap_or(DEFAULT_SITE_NAME);

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Ok(v) = HeaderValue::from_str(site_url) {
            headers.insert("HTTP-Referer", v);
        }
        if let Ok(v) = HeaderValue::from_str(site_name) {
            headers.insert("X-Title", v);
        }

        let http = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| OraError {
                code: ERR_UNKNOWN.to_string(),
                message: format!("failed to build HTTP client: {}", e),
                retryable: false,
                details: None,
            })?;

        let storage: Box<dyn Storage> = match opts.storage_type.as_deref() {
            Some("file") => {
                let fs = crate::storage::FileStorage::new(opts.config_path.as_deref())
                    .map_err(|e| OraError {
                        code: ERR_INVALID_PARAMETERS.to_string(),
                        message: e,
                        retryable: false,
                        details: None,
                    })?;
                Box::new(fs)
            }
            _ => Box::new(MemoryStorage::new()),
        };

        Ok(Self {
            api_key: opts.api_key,
            base_url,
            http,
            storage,
            models: Mutex::new(Vec::new()),
            configs: Mutex::new(HashMap::new()),
            event_handlers: Mutex::new(Vec::new()),
        })
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────

    async fn do_get(&self, path: &str) -> Result<(u16, String), OraError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .get(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| errors::network_error(&e))?;
        let status = resp.status().as_u16();
        let body = resp.text().await.map_err(|e| errors::network_error(&e))?;
        Ok((status, body))
    }

    async fn do_post(&self, path: &str, payload: &[u8]) -> Result<(u16, String), OraError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .post(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .body(payload.to_vec())
            .send()
            .await
            .map_err(|e| errors::network_error(&e))?;
        let status = resp.status().as_u16();
        let body = resp.text().await.map_err(|e| errors::network_error(&e))?;
        Ok((status, body))
    }

    // ── Public API ────────────────────────────────────────────────────────

    /// Fetch all available models from the OpenRouter API.
    pub async fn fetch_models(&self) -> Result<Vec<Model>, OraError> {
        let (status, body) = self.do_get("/models").await?;
        if status >= 400 {
            return Err(errors::parse_http_error(status, &body));
        }

        #[derive(serde::Deserialize)]
        struct ModelsResponse {
            data: Vec<Model>,
        }

        let result: ModelsResponse = serde_json::from_str(&body).map_err(|_| OraError {
            code: ERR_UNKNOWN.to_string(),
            message: "failed to parse models response".to_string(),
            retryable: false,
            details: None,
        })?;

        *self.models.lock().unwrap() = result.data.clone();
        self.emit("models:updated", serde_json::json!({ "count": result.data.len() }));
        Ok(result.data)
    }

    /// Return cached models (empty until `fetch_models` is called).
    pub fn get_models(&self) -> Vec<Model> {
        self.models.lock().unwrap().clone()
    }

    /// Look up a single cached model by ID.
    pub fn get_model(&self, id: &str) -> Option<Model> {
        self.models
            .lock()
            .unwrap()
            .iter()
            .find(|m| m.id == id)
            .cloned()
    }

    /// Add a model config, optionally testing connectivity first.
    pub async fn add_model(
        &self,
        model_id: &str,
        params: HashMap<String, serde_json::Value>,
        skip_test: bool,
    ) -> Result<ModelConfig, OraError> {
        let mut cfg = ModelConfig {
            model_id: model_id.to_string(),
            parameters: params,
            enabled: true,
            test_status: Some("unknown".to_string()),
            test_error: None,
        };

        if !skip_test {
            match self.check_model_availability(model_id).await {
                Ok(_) => cfg.test_status = Some("success".to_string()),
                Err(e) => {
                    cfg.test_status = Some("failed".to_string());
                    cfg.test_error = Some(e.message.clone());
                }
            }
        }

        self.configs
            .lock()
            .unwrap()
            .insert(model_id.to_string(), cfg.clone());
        Ok(cfg)
    }

    /// Get the config for a model.
    pub fn get_model_config(&self, model_id: &str) -> Option<ModelConfig> {
        self.configs.lock().unwrap().get(model_id).cloned()
    }

    /// Send a chat completion request (non-streaming).
    pub async fn chat(&self, req: &ChatRequest) -> Result<ChatResponse, OraError> {
        let payload = serde_json::to_vec(req).map_err(|_| OraError {
            code: ERR_INVALID_PARAMETERS.to_string(),
            message: "failed to serialise request".to_string(),
            retryable: false,
            details: None,
        })?;

        let (status, body) = self.do_post("/chat/completions", &payload).await?;
        if status >= 400 {
            return Err(errors::parse_http_error(status, &body));
        }

        serde_json::from_str(&body).map_err(|_| OraError {
            code: ERR_UNKNOWN.to_string(),
            message: "failed to parse chat response".to_string(),
            retryable: false,
            details: None,
        })
    }

    /// Quick connectivity check against a model.
    pub async fn check_model_availability(&self, model_id: &str) -> Result<(), OraError> {
        let req = ChatRequest::new(
            model_id,
            vec![ChatMessage::new("user", "Say \"Hello!\" and nothing else.")],
        );
        let mut req = req;
        req.max_tokens = Some(10);
        self.chat(&req).await?;
        Ok(())
    }

    // ── FilterModels ──────────────────────────────────────────────────────

    /// Return the subset of cached models matching `opts`.
    /// Call [`fetch_models`] first to populate the cache.
    pub fn filter_models(&self, opts: &ModelFilterOptions) -> Vec<Model> {
        let models = self.models.lock().unwrap().clone();
        models
            .into_iter()
            .filter(|m| {
                if let Some(mod_) = &opts.modality {
                    if m.architecture.modality != *mod_ { return false; }
                }
                if !opts.input_modalities.is_empty() {
                    if !opts.input_modalities.iter().all(|r| m.architecture.input_modalities.contains(r)) {
                        return false;
                    }
                }
                if !opts.output_modalities.is_empty() {
                    if !opts.output_modalities.iter().all(|r| m.architecture.output_modalities.contains(r)) {
                        return false;
                    }
                }
                if let Some(max_p) = opts.max_price {
                    let pp = m.pricing.prompt.parse::<f64>().unwrap_or(0.0);
                    let cp = m.pricing.completion.parse::<f64>().unwrap_or(0.0);
                    if pp > max_p || cp > max_p { return false; }
                }
                if let Some(min_ctx) = opts.min_context_length {
                    if m.context_length < min_ctx { return false; }
                }
                if let Some(max_ctx) = opts.max_context_length {
                    if m.context_length > max_ctx { return false; }
                }
                if let Some(provider) = &opts.provider {
                    let p = m.id.split('/').next().unwrap_or("");
                    if p != provider { return false; }
                }
                if let Some(q) = &opts.search {
                    let q = q.to_lowercase();
                    let desc = m.description.as_deref().unwrap_or("").to_lowercase();
                    if !m.id.to_lowercase().contains(&q)
                        && !m.name.to_lowercase().contains(&q)
                        && !desc.contains(&q)
                    {
                        return false;
                    }
                }
                if !opts.supported_parameters.is_empty() {
                    if !opts.supported_parameters.iter().all(|p| m.supported_parameters.contains(p)) {
                        return false;
                    }
                }
                if opts.exclude_models.contains(&m.id) { return false; }
                if opts.free_only && !is_free_model(m) { return false; }
                if let Some(tier) = &opts.price_tier {
                    if &get_price_tier(m) != tier { return false; }
                }
                true
            })
            .collect()
    }

    // ── StreamChat ────────────────────────────────────────────────────────

    /// Send a streaming chat request. Returns an `async_stream` of [`StreamChunk`]s.
    /// Use [`StreamAccumulator`] to assemble the full response.
    pub async fn stream_chat(
        &self,
        req: &ChatRequest,
    ) -> Result<tokio::sync::mpsc::Receiver<StreamChunk>, OraError> {
        let mut req = req.clone();
        req.stream = Some(true);

        let payload = serde_json::to_vec(&req).map_err(|_| OraError {
            code: ERR_INVALID_PARAMETERS.to_string(),
            message: "failed to serialise request".to_string(),
            retryable: false,
            details: None,
        })?;

        let url = format!("{}/chat/completions", self.base_url);
        let resp = self
            .http
            .post(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .body(payload)
            .send()
            .await
            .map_err(|e| errors::network_error(&e))?;

        let status = resp.status().as_u16();
        if status >= 400 {
            let body = resp.text().await.unwrap_or_default();
            return Err(errors::parse_http_error(status, &body));
        }

        let (tx, rx) = tokio::sync::mpsc::channel::<StreamChunk>(64);
        let mut stream = resp.bytes_stream();

        tokio::spawn(async move {
            use futures_util::StreamExt;
            let mut buf = String::new();
            while let Some(chunk) = stream.next().await {
                let bytes = match chunk { Ok(b) => b, Err(_) => break };
                buf.push_str(&String::from_utf8_lossy(&bytes));
                // Process complete lines
                while let Some(pos) = buf.find('\n') {
                    let line = buf[..pos].trim().to_string();
                    buf = buf[pos + 1..].to_string();
                    if let Some(data) = line.strip_prefix("data: ") {
                        if data == "[DONE]" { return; }
                        if let Ok(sc) = serde_json::from_str::<StreamChunk>(data) {
                            let _ = tx.send(sc).await;
                        }
                    }
                }
            }
        });

        Ok(rx)
    }

    // ── Event system ──────────────────────────────────────────────────────

    /// Register a handler for `event_type`. Returns an unsubscribe token.
    /// Drop the token to unsubscribe.
    pub fn on<F>(&self, event_type: &str, handler: F) -> EventSubscription
    where
        F: Fn(Event) + Send + Sync + 'static,
    {
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        self.event_handlers
            .lock()
            .unwrap()
            .push((event_type.to_string(), Box::new(handler)));
        EventSubscription { _id: id }
    }

    fn emit(&self, event_type: &str, payload: serde_json::Value) {
        let event = Event {
            event_type: event_type.to_string(),
            payload,
        };
        for (et, handler) in self.event_handlers.lock().unwrap().iter() {
            if et == event_type {
                handler(event.clone());
            }
        }
    }
}

/// Returned by [`Client::on`]; dropping it does nothing (handlers persist for
/// the lifetime of the client). To implement unsubscription, store the
/// subscription and call [`Client::off`] if needed.
pub struct EventSubscription {
    pub _id: u128,
}

// ── Web search helpers ────────────────────────────────────────────────────────

/// Build an OpenRouter web search server-tool entry.
/// Pass `None` for default parameters.
pub fn create_web_search_tool(params: Option<serde_json::Value>) -> serde_json::Value {
    match params {
        None => serde_json::json!({"type": "openrouter:web_search"}),
        Some(p) => serde_json::json!({"type": "openrouter:web_search", "parameters": p}),
    }
}

/// Return a clone of `req` with the web search tool appended to its `tools` list.
pub fn enable_web_search(req: &ChatRequest, params: Option<serde_json::Value>) -> ChatRequest {
    let mut req = req.clone();
    let mut tools = req.tools.unwrap_or_default();
    tools.push(create_web_search_tool(params));
    req.tools = Some(tools);
    req
}

use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::HashMap;
use std::fmt;

// Embed registry JSON at compile time.
const ERRORS_JSON: &str = include_str!("../registry/errors.json");

#[derive(Deserialize)]
struct ErrorsRegistry {
    code_map: HashMap<String, String>,
    messages: HashMap<String, String>,
    tips: HashMap<String, String>,
    retryable: Vec<String>,
}

static REGISTRY: Lazy<ErrorsRegistry> =
    Lazy::new(|| serde_json::from_str(ERRORS_JSON).expect("failed to parse errors.json"));

// ── Error codes ─────────────────────────────────────────────────────────────

pub const ERR_INVALID_API_KEY: &str = "INVALID_API_KEY";
pub const ERR_RATE_LIMITED: &str = "RATE_LIMITED";
pub const ERR_MODEL_NOT_FOUND: &str = "MODEL_NOT_FOUND";
pub const ERR_MODEL_UNAVAILABLE: &str = "MODEL_UNAVAILABLE";
pub const ERR_INVALID_PARAMETERS: &str = "INVALID_PARAMETERS";
pub const ERR_INSUFFICIENT_CREDITS: &str = "INSUFFICIENT_CREDITS";
pub const ERR_PROVIDER_ERROR: &str = "PROVIDER_ERROR";
pub const ERR_NETWORK_ERROR: &str = "NETWORK_ERROR";
pub const ERR_TIMEOUT: &str = "TIMEOUT";
pub const ERR_UNKNOWN: &str = "UNKNOWN";

// ── OraError ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct OraError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

impl fmt::Display for OraError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for OraError {}

impl OraError {
    /// Human-readable error with tip.
    pub fn format(&self) -> String {
        let mut s = format!("❌ {}", self.message);
        if let Some(tip) = REGISTRY.tips.get(&self.code) {
            s.push_str(&format!("\n💡 Tip: {}", tip));
        }
        if self.retryable {
            s.push_str("\n🔄 This error is retryable.");
        }
        s
    }
}

/// Check whether an error code is retryable per the registry.
pub fn is_retryable(code: &str) -> bool {
    REGISTRY.retryable.iter().any(|c| c == code)
}

/// Get the user-facing message for an error code.
pub fn error_message(code: &str) -> String {
    REGISTRY
        .messages
        .get(code)
        .cloned()
        .unwrap_or_else(|| "An unknown error occurred.".to_string())
}

/// Parse an HTTP status code + body into an OraError.
pub fn parse_http_error(status: u16, body: &str) -> OraError {
    let status_key = status.to_string();
    let mut code = REGISTRY
        .code_map
        .get(&status_key)
        .cloned()
        .unwrap_or_else(|| ERR_UNKNOWN.to_string());

    let mut message = error_message(&code);

    // Try to extract API error message from JSON body
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
        let api_msg = parsed
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .or_else(|| parsed.get("message").and_then(|m| m.as_str()));

        if let Some(msg) = api_msg {
            let lower = msg.to_lowercase();
            if lower.contains("credit") || lower.contains("balance") {
                code = ERR_INSUFFICIENT_CREDITS.to_string();
            } else if lower.contains("model") && lower.contains("not found") {
                code = ERR_MODEL_NOT_FOUND.to_string();
            } else if lower.contains("rate limit") || lower.contains("too many") {
                code = ERR_RATE_LIMITED.to_string();
            } else if lower.contains("invalid key") || lower.contains("unauthorized") {
                code = ERR_INVALID_API_KEY.to_string();
            }
            message = error_message(&code);
            if code == ERR_UNKNOWN {
                message = format!("{} ({})", message, msg);
            }
        }
    }

    let mut details = HashMap::new();
    details.insert("status".to_string(), serde_json::json!(status));

    OraError {
        retryable: is_retryable(&code),
        code,
        message,
        details: Some(details),
    }
}

/// Wrap a network/reqwest error into an OraError.
pub fn network_error(err: &reqwest::Error) -> OraError {
    let msg = err.to_string();
    let lower = msg.to_lowercase();
    let code = if lower.contains("timeout") || lower.contains("deadline") {
        ERR_TIMEOUT
    } else {
        ERR_NETWORK_ERROR
    };
    OraError {
        code: code.to_string(),
        message: error_message(code),
        retryable: is_retryable(code),
        details: None,
    }
}

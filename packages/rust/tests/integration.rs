use openrouter_auto::*;
use std::collections::HashMap;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

// ── Helpers ─────────────────────────────────────────────────────────────────

fn test_client(base_url: &str) -> Client {
    Client::new(Options {
        api_key: "test-key".to_string(),
        base_url: Some(base_url.to_string()),
        site_url: None,
        site_name: None,
        storage_type: None,
        config_path: None,
    })
    .expect("failed to create client")
}

fn sample_model(id: &str, prompt_price: &str, completion_price: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": id,
        "description": "",
        "context_length": 4096,
        "created": 0,
        "architecture": {
            "modality": "text",
            "input_modalities": ["text"],
            "output_modalities": ["text"]
        },
        "pricing": {
            "prompt": prompt_price,
            "completion": completion_price,
            "image": "0",
            "request": "0"
        },
        "supported_parameters": ["temperature", "max_tokens"],
        "top_provider": {
            "context_length": 4096,
            "max_completion_tokens": 4096,
            "is_moderated": false
        }
    })
}

// ── NewClient ───────────────────────────────────────────────────────────────

#[test]
fn test_new_client_missing_api_key() {
    let result = Client::new(Options {
        api_key: String::new(),
        base_url: None,
        site_url: None,
        site_name: None,
        storage_type: None,
        config_path: None,
    });
    assert!(result.is_err());
}

#[test]
fn test_new_client_bad_scheme() {
    let result = Client::new(Options {
        api_key: "k".to_string(),
        base_url: Some("ftp://example.com".to_string()),
        site_url: None,
        site_name: None,
        storage_type: None,
        config_path: None,
    });
    assert!(result.is_err());
}

// ── FetchModels ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_fetch_models() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "data": [
                sample_model("openai/gpt-4o", "0.001", "0.002"),
                sample_model("anthropic/claude-3-5-sonnet:free", "0", "0"),
            ]
        })))
        .mount(&server)
        .await;

    let client = test_client(&server.uri());
    let models = client.fetch_models().await.unwrap();
    assert_eq!(models.len(), 2);
    assert_eq!(models[0].id, "openai/gpt-4o");
}

#[tokio::test]
async fn test_fetch_models_http_error() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(
            ResponseTemplate::new(401)
                .set_body_json(serde_json::json!({"error": {"message": "Unauthorized"}})),
        )
        .mount(&server)
        .await;

    let client = test_client(&server.uri());
    let err = client.fetch_models().await.unwrap_err();
    assert_eq!(err.code, "INVALID_API_KEY");
}

// ── Chat ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_chat() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "id": "chatcmpl-test",
            "model": "test-model",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "Hello!"},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            "created": 0
        })))
        .mount(&server)
        .await;

    let client = test_client(&server.uri());
    let req = ChatRequest::new("test-model", vec![ChatMessage::new("user", "Hi")]);
    let resp = client.chat(&req).await.unwrap();
    assert_eq!(resp.content(), "Hello!");
}

#[tokio::test]
async fn test_chat_rate_limit() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(
            ResponseTemplate::new(429)
                .set_body_json(serde_json::json!({"error": {"message": "rate limit exceeded"}})),
        )
        .mount(&server)
        .await;

    let client = test_client(&server.uri());
    let req = ChatRequest::new("test-model", vec![ChatMessage::new("user", "Hi")]);
    let err = client.chat(&req).await.unwrap_err();
    assert_eq!(err.code, "RATE_LIMITED");
    assert!(err.retryable);
}

// ── IsFreeModel / GetPriceTier ──────────────────────────────────────────────

#[test]
fn test_is_free_model() {
    let free: Model =
        serde_json::from_value(sample_model("vendor/model:free", "0", "0")).unwrap();
    assert!(is_free_model(&free));

    let paid: Model =
        serde_json::from_value(sample_model("vendor/model", "0.001", "0.002")).unwrap();
    assert!(!is_free_model(&paid));
}

#[test]
fn test_get_price_tier() {
    let free: Model =
        serde_json::from_value(sample_model("a:free", "0", "0")).unwrap();
    assert_eq!(get_price_tier(&free), "free");

    let expensive: Model =
        serde_json::from_value(sample_model("a", "0.1", "0.1")).unwrap();
    assert_eq!(get_price_tier(&expensive), "expensive");
}

// ── CalculateCost ───────────────────────────────────────────────────────────

#[test]
fn test_calculate_cost() {
    let model: Model =
        serde_json::from_value(sample_model("vendor/model", "0.001", "0.002")).unwrap();
    let est = calculate_cost(&model, 1000, 500);
    let want_prompt = 0.001;
    let want_completion = 0.001;
    assert!((est.prompt_cost - want_prompt).abs() < 1e-9);
    assert!((est.completion_cost - want_completion).abs() < 1e-9);
    assert!((est.total_cost - (want_prompt + want_completion)).abs() < 1e-9);
}

// ── EstimateTokens ──────────────────────────────────────────────────────────

#[test]
fn test_estimate_tokens() {
    // 4 chars/token → "test" (4 chars) → 1 token
    assert_eq!(estimate_tokens("test"), 1);
    assert_eq!(estimate_tokens(""), 0);
}

// ── ValidateParameters ──────────────────────────────────────────────────────

#[test]
fn test_validate_parameters() {
    let model: Model = serde_json::from_value(sample_model("test/model", "0", "0")).unwrap();

    // Valid
    let mut params = HashMap::new();
    params.insert("temperature".to_string(), serde_json::json!(0.7));
    let errs = validate_parameters(&model, &params);
    assert!(errs.is_empty(), "expected no errors, got: {:?}", errs);

    // Out of range
    let mut params = HashMap::new();
    params.insert("temperature".to_string(), serde_json::json!(5.0));
    let errs = validate_parameters(&model, &params);
    assert!(!errs.is_empty(), "expected error for temperature=5.0");

    // Unsupported param
    let mut params = HashMap::new();
    params.insert("unknown_param".to_string(), serde_json::json!(1));
    let errs = validate_parameters(&model, &params);
    assert!(!errs.is_empty(), "expected error for unsupported param");
}

// ── MemoryStorage ───────────────────────────────────────────────────────────

#[test]
fn test_memory_storage() {
    let s = MemoryStorage::new();
    s.set("key1", serde_json::json!("value1"));
    assert_eq!(s.get("key1"), Some(serde_json::json!("value1")));

    s.remove("key1");
    assert_eq!(s.get("key1"), None);

    s.set("a", serde_json::json!(1));
    s.set("b", serde_json::json!(2));
    s.clear();
    assert_eq!(s.get("a"), None);
}

// ── AddModel ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_add_model_skip_test() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "id": "chatcmpl-test",
            "model": "openai/gpt-4o",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "Hi"},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 5, "completion_tokens": 1, "total_tokens": 6},
            "created": 0
        })))
        .mount(&server)
        .await;

    let client = test_client(&server.uri());
    let params = HashMap::new();
    let cfg = client
        .add_model("openai/gpt-4o", params, true)
        .await
        .unwrap();
    assert_eq!(cfg.model_id, "openai/gpt-4o");
    assert_eq!(cfg.test_status, Some("unknown".to_string()));
}

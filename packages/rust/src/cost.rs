use crate::types::{CostEstimate, Model};
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::HashMap;

const COST_JSON: &str = include_str!("../registry/cost.json");

#[derive(Deserialize)]
struct PriceTierEntry {
    max_avg_price: Option<f64>,
}

#[derive(Deserialize)]
struct CostRegistry {
    price_tiers: HashMap<String, PriceTierEntry>,
    token_estimate_chars_per_token: usize,
    #[allow(dead_code)]
    message_overhead_tokens: usize,
}

static COST_REG: Lazy<CostRegistry> =
    Lazy::new(|| serde_json::from_str(COST_JSON).expect("failed to parse cost.json"));

/// Returns true when the model carries zero-cost pricing or a `:free` suffix.
pub fn is_free_model(model: &Model) -> bool {
    if model.id.ends_with(":free") {
        return true;
    }
    parse_price(&model.pricing.prompt) == 0.0 && parse_price(&model.pricing.completion) == 0.0
}

/// Classify a model as "free", "cheap", "moderate", or "expensive".
pub fn get_price_tier(model: &Model) -> &'static str {
    if is_free_model(model) {
        return "free";
    }
    let avg = (parse_price(&model.pricing.prompt) + parse_price(&model.pricing.completion)) / 2.0;
    for tier in &["cheap", "moderate"] {
        if let Some(entry) = COST_REG.price_tiers.get(*tier) {
            if let Some(max) = entry.max_avg_price {
                if avg <= max {
                    return tier;
                }
            }
        }
    }
    "expensive"
}

/// Calculate cost for the given token counts.
pub fn calculate_cost(model: &Model, prompt_tokens: i64, completion_tokens: i64) -> CostEstimate {
    let pp = parse_price(&model.pricing.prompt);
    let cp = parse_price(&model.pricing.completion);
    let prompt_cost = (prompt_tokens as f64 / 1000.0) * pp;
    let completion_cost = (completion_tokens as f64 / 1000.0) * cp;
    CostEstimate {
        prompt_cost,
        completion_cost,
        total_cost: prompt_cost + completion_cost,
        currency: "USD".to_string(),
    }
}

/// Rough token count using the registry chars-per-token ratio.
pub fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    let cpt = COST_REG.token_estimate_chars_per_token.max(1);
    (text.len() + cpt - 1) / cpt
}

fn parse_price(s: &str) -> f64 {
    s.parse::<f64>().unwrap_or(0.0)
}

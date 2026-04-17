use crate::types::Model;
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

const PARAMETERS_JSON: &str = include_str!("../registry/parameters.json");
const PLATFORM_PARAMS_JSON: &str = include_str!("../registry/platform-params.json");

#[derive(Debug, Deserialize)]
struct ParamDef {
    #[serde(rename = "type")]
    param_type: String,
    #[serde(default)]
    min: Option<f64>,
    #[serde(default)]
    max: Option<f64>,
    #[serde(default)]
    default: Option<serde_json::Value>,
}

static PARAM_DEFS: Lazy<HashMap<String, ParamDef>> =
    Lazy::new(|| serde_json::from_str(PARAMETERS_JSON).expect("failed to parse parameters.json"));

static PLATFORM_PARAMS: Lazy<HashSet<String>> = Lazy::new(|| {
    let list: Vec<String> =
        serde_json::from_str(PLATFORM_PARAMS_JSON).expect("failed to parse platform-params.json");
    list.into_iter().collect()
});

/// Validate parameters against the registry definitions for a model.
/// Returns a list of human-readable error strings (empty = valid).
pub fn validate_parameters(
    model: &Model,
    params: &HashMap<String, serde_json::Value>,
) -> Vec<String> {
    let supported: HashSet<&str> = model.supported_parameters.iter().map(|s| s.as_str()).collect();
    let mut errors = Vec::new();

    for (name, value) in params {
        // Platform-level params are always allowed.
        if PLATFORM_PARAMS.contains(name.as_str()) {
            continue;
        }
        if !supported.contains(name.as_str()) {
            errors.push(format!("{} is not supported by model {}", name, model.id));
            continue;
        }
        if let Some(def) = PARAM_DEFS.get(name.as_str()) {
            if let Some(msg) = validate_param_value(name, value, def) {
                errors.push(msg);
            }
        }
    }
    errors
}

/// Return a map of param name → default value for a model's supported params.
pub fn get_default_parameters(model: &Model) -> HashMap<String, serde_json::Value> {
    let mut defaults = HashMap::new();
    for name in &model.supported_parameters {
        if let Some(def) = PARAM_DEFS.get(name.as_str()) {
            if let Some(ref val) = def.default {
                defaults.insert(name.clone(), val.clone());
            }
        }
    }
    defaults
}

fn validate_param_value(name: &str, value: &serde_json::Value, def: &ParamDef) -> Option<String> {
    match def.param_type.as_str() {
        "number" => {
            let v = value.as_f64()?;
            if let Some(min) = def.min {
                if v < min {
                    return Some(format!("{} must be >= {}", name, min));
                }
            }
            if let Some(max) = def.max {
                if v > max {
                    return Some(format!("{} must be <= {}", name, max));
                }
            }
            None
        }
        "integer" => {
            if let Some(v) = value.as_f64() {
                if v != (v as i64) as f64 {
                    return Some(format!("{} must be an integer", name));
                }
            } else {
                return Some(format!("{} must be an integer", name));
            }
            None
        }
        "boolean" => {
            if !value.is_boolean() {
                return Some(format!("{} must be a boolean", name));
            }
            None
        }
        "string" => {
            if !value.is_string() {
                return Some(format!("{} must be a string", name));
            }
            None
        }
        _ => None,
    }
}

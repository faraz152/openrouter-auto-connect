"""
OpenRouter Auto - Parameter Management
Dynamic parameter validation and configuration
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from .types import OpenRouterModel, ParameterDefinition

_REGISTRY_DIR = Path(__file__).resolve().parent.parent.parent / "registry"

# Build DEFAULT_PARAMETERS from registry JSON
def _load_parameters() -> Dict[str, ParameterDefinition]:
    raw = json.loads((_REGISTRY_DIR / "parameters.json").read_text())
    params: Dict[str, ParameterDefinition] = {}
    for name, d in raw.items():
        params[name] = ParameterDefinition(name=name, required=False, **d)
    return params

DEFAULT_PARAMETERS: Dict[str, ParameterDefinition] = _load_parameters()

# Build PLATFORM_PARAMS from registry JSON
PLATFORM_PARAMS: frozenset = frozenset(
    json.loads((_REGISTRY_DIR / "platform-params.json").read_text())
)


def get_model_parameters(model: OpenRouterModel) -> List[ParameterDefinition]:
    """Get parameter definitions for a specific model"""
    supported = model.supported_parameters or []
    definitions: List[ParameterDefinition] = []

    for param_name in supported:
        definition = DEFAULT_PARAMETERS.get(param_name)
        if definition:
            # Adjust max_tokens based on model's context length
            if param_name == "max_tokens" and model.top_provider.max_completion_tokens:
                definitions.append(ParameterDefinition(
                    **{**definition.__dict__, "max": model.top_provider.max_completion_tokens}
                ))
            elif param_name == "max_tokens" and model.context_length:
                definitions.append(ParameterDefinition(
                    **{**definition.__dict__, "max": model.context_length}
                ))
            else:
                definitions.append(definition)

    return definitions


def validate_parameter(
    name: str,
    value: Any,
    definition: ParameterDefinition
) -> Tuple[bool, Optional[str]]:
    """Validate a parameter value"""

    if value is None:
        return True, None

    # Check type
    if definition.type == "number" and not isinstance(value, (int, float)):
        return False, f"{name} must be a number"

    if definition.type == "integer" and not isinstance(value, int):
        return False, f"{name} must be an integer"

    if definition.type == "boolean" and not isinstance(value, bool):
        return False, f"{name} must be a boolean"

    if definition.type == "string" and not isinstance(value, str):
        return False, f"{name} must be a string"

    if definition.type == "array" and not isinstance(value, list):
        return False, f"{name} must be an array"

    # Check range
    if definition.min is not None and value < definition.min:
        return False, f"{name} must be at least {definition.min}"

    if definition.max is not None and value > definition.max:
        return False, f"{name} must be at most {definition.max}"

    # Check enum
    if definition.enum and value not in definition.enum:
        return False, f"{name} must be one of: {', '.join(map(str, definition.enum))}"

    return True, None


def validate_parameters(
    model: OpenRouterModel,
    params: Dict[str, Any]
) -> Tuple[bool, Dict[str, str]]:
    """Validate all parameters for a model"""
    errors: Dict[str, str] = {}
    supported = model.supported_parameters or []

    # Check for unsupported parameters (skip platform-level params)
    for key in params.keys():
        if key not in supported and key not in PLATFORM_PARAMS:
            errors[key] = f"Parameter '{key}' is not supported by this model"

    # Validate supported parameters
    definitions = get_model_parameters(model)
    for definition in definitions:
        value = params.get(definition.name)
        if value is not None:
            valid, error = validate_parameter(definition.name, value, definition)
            if not valid:
                errors[definition.name] = error

    return len(errors) == 0, errors


def get_default_parameters(model: OpenRouterModel) -> Dict[str, Any]:
    """Get default parameters for a model"""
    defaults: Dict[str, Any] = {}
    definitions = get_model_parameters(model)

    for definition in definitions:
        if definition.default is not None:
            defaults[definition.name] = definition.default

    return defaults


def merge_with_defaults(
    model: OpenRouterModel,
    user_params: Dict[str, Any]
) -> Dict[str, Any]:
    """Merge user parameters with defaults"""
    defaults = get_default_parameters(model)
    return {**defaults, **user_params}


def sanitize_parameters(params: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize parameters (remove None values)"""
    return {k: v for k, v in params.items() if v is not None}


def get_parameter_help(name: str) -> str:
    """Get parameter help text"""
    definition = DEFAULT_PARAMETERS.get(name)
    return definition.description if definition else "No description available"


def is_parameter_supported(model: OpenRouterModel, param_name: str) -> bool:
    """Check if a parameter is supported by a model"""
    return param_name in (model.supported_parameters or [])


def get_parameter_constraints(definition: ParameterDefinition) -> Dict[str, Any]:
    """Get parameter constraints for UI display"""
    constraints: Dict[str, Any] = {}

    if definition.min is not None:
        constraints["min"] = definition.min
    if definition.max is not None:
        constraints["max"] = definition.max
    if definition.type == "number":
        constraints["step"] = 0.1
    elif definition.type == "integer":
        constraints["step"] = 1

    return constraints

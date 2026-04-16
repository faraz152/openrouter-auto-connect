"""
OpenRouter Auto - Parameter Management
Dynamic parameter validation and configuration
"""

from typing import Dict, Any, List, Optional, Tuple
from .types import OpenRouterModel, ParameterDefinition

# Default parameter definitions with ranges
DEFAULT_PARAMETERS: Dict[str, ParameterDefinition] = {
    "temperature": ParameterDefinition(
        name="temperature",
        type="number",
        description="Controls randomness. Lower = more deterministic, higher = more creative.",
        default=1.0,
        min=0.0,
        max=2.0,
    ),
    "top_p": ParameterDefinition(
        name="top_p",
        type="number",
        description="Nucleus sampling. Only consider tokens with top_p cumulative probability.",
        default=1.0,
        min=0.0,
        max=1.0,
    ),
    "top_k": ParameterDefinition(
        name="top_k",
        type="integer",
        description="Only sample from the top K tokens.",
        default=0,
        min=0,
    ),
    "max_tokens": ParameterDefinition(
        name="max_tokens",
        type="integer",
        description="Maximum number of tokens to generate.",
        min=1,
    ),
    "max_completion_tokens": ParameterDefinition(
        name="max_completion_tokens",
        type="integer",
        description="Maximum completion tokens (alternative to max_tokens).",
        min=1,
    ),
    "frequency_penalty": ParameterDefinition(
        name="frequency_penalty",
        type="number",
        description="Penalize tokens based on their frequency in the text so far.",
        default=0.0,
        min=-2.0,
        max=2.0,
    ),
    "presence_penalty": ParameterDefinition(
        name="presence_penalty",
        type="number",
        description="Penalize tokens that have appeared in the text so far.",
        default=0.0,
        min=-2.0,
        max=2.0,
    ),
    "repetition_penalty": ParameterDefinition(
        name="repetition_penalty",
        type="number",
        description="Penalize repetition of tokens.",
        default=1.0,
        min=0.0,
    ),
    "min_p": ParameterDefinition(
        name="min_p",
        type="number",
        description="Minimum probability for a token to be considered.",
        default=0.0,
        min=0.0,
        max=1.0,
    ),
    "top_a": ParameterDefinition(
        name="top_a",
        type="number",
        description="Alternative to top_p and top_k.",
        default=0.0,
        min=0.0,
        max=1.0,
    ),
    "seed": ParameterDefinition(
        name="seed",
        type="integer",
        description="Seed for deterministic sampling.",
    ),
    "stop": ParameterDefinition(
        name="stop",
        type="array",
        description="Stop sequences. The API will stop generating at these sequences.",
    ),
    "stream": ParameterDefinition(
        name="stream",
        type="boolean",
        description="Stream the response as it is generated.",
        default=False,
    ),
}


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
    
    # Check for unsupported parameters
    for key in params.keys():
        if key not in supported and key not in ["model", "messages"]:
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

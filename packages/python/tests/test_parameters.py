"""Tests for parameter validation"""

import pytest
from openrouter_auto.parameters import (
    DEFAULT_PARAMETERS,
    get_model_parameters,
    validate_parameter,
    validate_parameters,
    get_default_parameters,
    merge_with_defaults,
    sanitize_parameters,
)
from openrouter_auto.types import (
    OpenRouterModel,
    ModelArchitecture,
    ModelPricing,
    TopProvider,
)


def make_model(**overrides) -> OpenRouterModel:
    defaults = dict(
        id="test/model",
        name="Test Model",
        context_length=4096,
        created=0,
        architecture=ModelArchitecture(
            modality="text->text",
            input_modalities=["text"],
            output_modalities=["text"],
        ),
        pricing=ModelPricing(prompt="0.001", completion="0.002", image="0", request="0"),
        supported_parameters=["temperature", "max_tokens", "top_p"],
        top_provider=TopProvider(context_length=4096, max_completion_tokens=2048, is_moderated=False),
    )
    defaults.update(overrides)
    return OpenRouterModel(**defaults)


def test_validate_parameter_valid_temperature():
    defn = DEFAULT_PARAMETERS["temperature"]
    valid, error = validate_parameter("temperature", 0.7, defn)
    assert valid is True
    assert error is None


def test_validate_parameter_above_max():
    defn = DEFAULT_PARAMETERS["temperature"]
    valid, error = validate_parameter("temperature", 3.0, defn)
    assert valid is False
    assert "at most" in error


def test_validate_parameter_integer_type():
    defn = DEFAULT_PARAMETERS["max_tokens"]
    valid, error = validate_parameter("max_tokens", 10.5, defn)
    assert valid is False
    assert "integer" in error


def test_validate_parameters_valid():
    model = make_model()
    valid, errors = validate_parameters(model, {"temperature": 1.0})
    assert valid is True
    assert len(errors) == 0


def test_validate_parameters_unsupported():
    model = make_model(supported_parameters=["temperature"])
    valid, errors = validate_parameters(model, {"seed": 42})
    assert valid is False
    assert "seed" in errors


def test_merge_with_defaults():
    model = make_model()
    merged = merge_with_defaults(model, {"max_tokens": 100})
    assert merged["temperature"] == 1.0
    assert merged["max_tokens"] == 100


def test_merge_user_overrides_defaults():
    model = make_model()
    merged = merge_with_defaults(model, {"temperature": 0.5})
    assert merged["temperature"] == 0.5


def test_sanitize_parameters():
    result = sanitize_parameters({"a": 1, "b": None, "c": "ok"})
    assert result == {"a": 1, "c": "ok"}


def test_get_model_parameters_only_supported():
    model = make_model(supported_parameters=["temperature"])
    defs = get_model_parameters(model)
    assert len(defs) == 1
    assert defs[0].name == "temperature"


def test_get_model_parameters_adjusts_max_tokens():
    model = make_model()
    defs = get_model_parameters(model)
    mt = next(d for d in defs if d.name == "max_tokens")
    assert mt.max == 2048

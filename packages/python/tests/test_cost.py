"""Tests for cost calculator"""

import pytest
from openrouter_auto.cost import (
    calculate_cost,
    estimate_tokens,
    format_cost,
    is_free_model,
    get_price_tier,
)
from openrouter_auto.types import (
    OpenRouterModel,
    ModelArchitecture,
    ModelPricing,
    TopProvider,
)


def make_model(prompt="0.001", completion="0.002") -> OpenRouterModel:
    return OpenRouterModel(
        id="test/model",
        name="Test Model",
        context_length=4096,
        created=0,
        architecture=ModelArchitecture(
            modality="text->text",
            input_modalities=["text"],
            output_modalities=["text"],
        ),
        pricing=ModelPricing(prompt=prompt, completion=completion, image="0", request="0"),
        supported_parameters=[],
        top_provider=TopProvider(context_length=4096, max_completion_tokens=2048, is_moderated=False),
    )


def test_calculate_cost():
    model = make_model("0.001", "0.002")
    cost = calculate_cost(model, 1000, 500)
    assert abs(cost.prompt_cost - 0.001) < 1e-9
    assert abs(cost.completion_cost - 0.001) < 1e-9
    assert abs(cost.total_cost - 0.002) < 1e-9
    assert cost.currency == "USD"


def test_calculate_cost_free():
    model = make_model("0", "0")
    cost = calculate_cost(model, 1000, 500)
    assert cost.total_cost == 0


def test_estimate_tokens_empty():
    assert estimate_tokens("") == 0


def test_estimate_tokens_approximate():
    tokens = estimate_tokens("Hello, world!")  # 13 chars
    assert 3 <= tokens <= 5


def test_format_cost_free():
    assert format_cost(0) == "Free"


def test_format_cost_small():
    result = format_cost(0.0001)
    assert result.startswith("$")


def test_is_free_model_true():
    assert is_free_model(make_model("0", "0")) is True


def test_is_free_model_false():
    assert is_free_model(make_model("0.001", "0.002")) is False


def test_get_price_tier_free():
    assert get_price_tier(make_model("0", "0")) == "free"


def test_get_price_tier_expensive():
    assert get_price_tier(make_model("0.1", "0.1")) == "expensive"

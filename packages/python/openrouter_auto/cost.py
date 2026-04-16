"""
OpenRouter Auto - Cost Calculator
Real-time cost estimation for OpenRouter models
"""

from typing import List
from .types import OpenRouterModel, CostEstimate


def calculate_cost(
    model: OpenRouterModel,
    prompt_tokens: int,
    completion_tokens: int = 0,
    reasoning_tokens: int = 0
) -> CostEstimate:
    """Calculate cost for a request.
    Reasoning tokens are billed at the completion rate by default on OpenRouter.
    """
    pricing = model.pricing
    
    # Parse pricing (stored as strings)
    prompt_price = float(pricing.prompt) if pricing.prompt else 0.0
    completion_price = float(pricing.completion) if pricing.completion else 0.0
    
    # Calculate costs (prices are per 1K tokens)
    prompt_cost = (prompt_tokens / 1000) * prompt_price
    completion_cost = (completion_tokens / 1000) * completion_price
    # Reasoning tokens billed at completion rate
    reasoning_cost = (reasoning_tokens / 1000) * completion_price
    
    return CostEstimate(
        prompt_cost=prompt_cost,
        completion_cost=completion_cost,
        reasoning_cost=reasoning_cost,
        total_cost=prompt_cost + completion_cost + reasoning_cost,
    )


def estimate_tokens(text: str) -> int:
    """Estimate tokens from text (rough approximation)"""
    if not text:
        return 0
    # 1 token ≈ 4 characters for English text
    return (len(text) + 3) // 4


def calculate_chat_cost(
    model: OpenRouterModel,
    messages: List[dict],
    expected_response_tokens: int = 500
) -> CostEstimate:
    """Calculate cost for a chat conversation"""
    # Estimate prompt tokens from all messages
    prompt_tokens = 0
    for message in messages:
        content = message.get("content", "")
        prompt_tokens += estimate_tokens(content)
        # Add overhead for message format
        prompt_tokens += 4
    
    return calculate_cost(model, prompt_tokens, expected_response_tokens)


def format_cost(cost: float) -> str:
    """Format cost for display"""
    if cost == 0:
        return "Free"
    if cost < 0.000001:
        return "< $0.000001"
    if cost < 0.001:
        return f"${cost:.6f}"
    if cost < 0.01:
        return f"${cost:.4f}"
    return f"${cost:.2f}"


def format_price_per_1k(price: str) -> str:
    """Format price per 1K tokens"""
    value = float(price) if price else 0.0
    if value == 0:
        return "Free"
    return f"${value:.6f}/1K tokens"


def compare_model_costs(
    models: List[OpenRouterModel],
    prompt_tokens: int,
    completion_tokens: int = 500
) -> List[tuple]:
    """Compare costs between models"""
    results = []
    for model in models:
        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        results.append((model, cost))
    
    # Sort by total cost
    results.sort(key=lambda x: x[1].total_cost)
    return results


def get_cheapest_model(
    models: List[OpenRouterModel],
    prompt_tokens: int,
    completion_tokens: int = 500
) -> Optional[OpenRouterModel]:
    """Get cheapest model for a task"""
    sorted_models = compare_model_costs(models, prompt_tokens, completion_tokens)
    return sorted_models[0][0] if sorted_models else None


def is_free_model(model: OpenRouterModel) -> bool:
    """Check if a model is free"""
    prompt_price = float(model.pricing.prompt) if model.pricing.prompt else 0.0
    completion_price = float(model.pricing.completion) if model.pricing.completion else 0.0
    return prompt_price == 0.0 and completion_price == 0.0


def get_price_tier(model: OpenRouterModel) -> str:
    """Get price tier for a model"""
    prompt_price = float(model.pricing.prompt) if model.pricing.prompt else 0.0
    completion_price = float(model.pricing.completion) if model.pricing.completion else 0.0
    avg_price = (prompt_price + completion_price) / 2
    
    if avg_price == 0:
        return "free"
    if avg_price < 0.0001:
        return "cheap"
    if avg_price < 0.01:
        return "moderate"
    return "expensive"


def calculate_monthly_estimate(
    model: OpenRouterModel,
    daily_requests: int,
    avg_prompt_tokens: int,
    avg_completion_tokens: int
) -> CostEstimate:
    """Calculate monthly cost estimate"""
    daily_cost = calculate_cost(model, avg_prompt_tokens, avg_completion_tokens)
    monthly_cost = daily_cost.total_cost * daily_requests * 30
    
    return CostEstimate(
        prompt_cost=daily_cost.prompt_cost * daily_requests * 30,
        completion_cost=daily_cost.completion_cost * daily_requests * 30,
        total_cost=monthly_cost,
    )


def get_cost_breakdown(
    model: OpenRouterModel,
    prompt_tokens: int,
    completion_tokens: int = 500
) -> dict:
    """Get cost breakdown for display"""
    cost = calculate_cost(model, prompt_tokens, completion_tokens)
    
    return {
        "prompt": format_cost(cost.prompt_cost),
        "completion": format_cost(cost.completion_cost),
        "total": format_cost(cost.total_cost),
        "per_1k_prompt": format_price_per_1k(model.pricing.prompt),
        "per_1k_completion": format_price_per_1k(model.pricing.completion),
    }

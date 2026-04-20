"""
OpenRouter Auto - Python Basic Example
Basic usage of OpenRouter Auto with Python
"""

import asyncio
import os
from openrouter_auto import create_openrouter_auto
from openrouter_auto.types import ChatRequest, ChatMessage, ModelFilterOptions


async def main():
    # Get API key from environment
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("Please set OPENROUTER_API_KEY environment variable")
        return

    # Initialize OpenRouter Auto
    print("🚀 Initializing OpenRouter Auto...")
    or_auto = create_openrouter_auto({
        "api_key": api_key,
        "storage_type": "file",
        "config_path": "./.openrouter-auto.json",
        "enable_testing": True,
    })

    # Initialize SDK
    await or_auto.initialize()

    # Get all models
    models = or_auto.get_models()
    print(f"✅ Loaded {len(models)} models")

    # Show some free models
    free_models = or_auto.filter_models(ModelFilterOptions(free_only=True))
    print(f"\n🆓 Free models available: {len(free_models)}")
    for model in free_models[:5]:
        print(f"  - {model.name} ({model.id})")

    # Add a model
    model_id = "anthropic/claude-3.5-sonnet"
    print(f"\n➕ Adding model: {model_id}")
    
    try:
        config = await or_auto.add_model(
            model_id,
            parameters={
                "temperature": 0.7,
                "max_tokens": 1000,
            }
        )
        print(f"✅ Model added successfully!")
        print(f"   Test status: {config.test_status}")
        print(f"   Parameters: {config.parameters}")
    except Exception as e:
        print(f"❌ Error adding model: {e}")
        return

    # Calculate cost
    print(f"\n💰 Calculating cost...")
    cost = or_auto.calculate_cost(model_id, prompt_tokens=100, completion_tokens=50)
    print(f"   Prompt cost: ${cost.prompt_cost:.6f}")
    print(f"   Completion cost: ${cost.completion_cost:.6f}")
    print(f"   Total cost: ${cost.total_cost:.6f}")

    # Chat with the model
    print(f"\n💬 Sending message...")
    try:
        response = await or_auto.chat(ChatRequest(
            model=model_id,
            messages=[
                ChatMessage(role="user", content="What is the capital of France?")
            ],
        ))
        
        print(f"✅ Response received!")
        print(f"   Model: {response.model}")
        print(f"   Content: {response.choices[0]['message']['content']}")
        
        if response.usage:
            print(f"   Tokens used: {response.usage['total_tokens']}")
    except Exception as e:
        print(f"❌ Chat error: {e}")

    # Test all configured models
    print(f"\n🧪 Testing all configured models...")
    results = await or_auto.test_all_models()
    for result in results:
        status = "✅" if result.success else "❌"
        print(f"   {status} {result.model}: {result.response_time:.2f}s")
        if result.error:
            print(f"      Error: {result.error}")

    # Cleanup
    await or_auto.close()
    print("\n👋 Done!")


if __name__ == "__main__":
    asyncio.run(main())

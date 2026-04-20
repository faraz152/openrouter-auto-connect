#!/usr/bin/env python3
"""
OpenRouter Auto - CLI Tool
One-command setup and management for OpenRouter Auto
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional

from .sdk import create_openrouter_auto
from .types import ChatRequest, ChatMessage, ModelFilterOptions


def get_config_path() -> Path:
    """Get default config path"""
    return Path.home() / ".openrouter-auto" / "config.json"


def load_config() -> dict:
    """Load existing config"""
    config_path = get_config_path()
    if config_path.exists():
        with open(config_path, "r") as f:
            return json.load(f)
    return {}


def save_config(config: dict) -> None:
    """Save config"""
    import stat
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    # Restrict to owner read/write only — config contains the API key
    config_path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def print_header(text: str) -> None:
    """Print header"""
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}\n")


def print_success(text: str) -> None:
    """Print success message"""
    print(f"✅ {text}")


def print_error(text: str) -> None:
    """Print error message"""
    print(f"❌ {text}")


def print_info(text: str) -> None:
    """Print info message"""
    print(f"ℹ️  {text}")


async def cmd_setup(args) -> None:
    """Setup command"""
    print_header("OpenRouter Auto Setup")

    # Check for existing config
    config = load_config()

    # Get API key
    api_key = args.api_key or config.get("api_key") or os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        print("Please provide your OpenRouter API key.")
        print("You can get one at: https://openrouter.ai/keys")
        api_key = input("\nAPI Key: ").strip()

    if not api_key:
        print_error("API key is required")
        return

    # Save config
    config["api_key"] = api_key
    save_config(config)

    print_success("Configuration saved!")
    print_info(f"Config location: {get_config_path()}")

    # Test connection
    print("\nTesting connection...")
    try:
        or_auto = create_openrouter_auto({
            "api_key": api_key,
            "storage_type": "memory",
        })
        await or_auto.initialize()
        models = or_auto.get_models()
        print_success(f"Connection successful! Found {len(models)} models.")
        await or_auto.close()
    except Exception as e:
        print_error(f"Connection failed: {e}")


async def cmd_models(args) -> None:
    """List models command"""
    print_header("Available Models")

    config = load_config()
    api_key = args.api_key or config.get("api_key") or os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        print_error("API key not found. Run 'openrouter-auto setup' first.")
        return

    try:
        or_auto = create_openrouter_auto({
            "api_key": api_key,
            "storage_type": "memory",
        })
        await or_auto.initialize()

        # Filter models
        models = or_auto.filter_models(ModelFilterOptions(
            free_only=args.free or None,
            provider=getattr(args, 'provider', None),
            search=getattr(args, 'search', None),
        ))

        print(f"Found {len(models)} models:\n")

        for model in models[:args.limit]:
            prompt_price = float(model.pricing.prompt) if model.pricing.prompt else 0
            completion_price = float(model.pricing.completion) if model.pricing.completion else 0

            price_str = "Free" if prompt_price == 0 and completion_price == 0 else \
                       f"${prompt_price:.6f}/${completion_price:.6f}"

            print(f"  📦 {model.name}")
            print(f"     ID: {model.id}")
            print(f"     Price: {price_str} per 1K tokens")
            print(f"     Context: {model.context_length:,} tokens")
            print(f"     Modality: {model.architecture.modality}")
            print()

        if len(models) > args.limit:
            print(f"... and {len(models) - args.limit} more models")

        await or_auto.close()

    except Exception as e:
        print_error(f"Error: {e}")


async def cmd_add(args) -> None:
    """Add model command"""
    print_header(f"Add Model: {args.model}")

    config = load_config()
    api_key = args.api_key or config.get("api_key") or os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        print_error("API key not found. Run 'openrouter-auto setup' first.")
        return

    try:
        or_auto = create_openrouter_auto({
            "api_key": api_key,
            "storage_type": "file",
        })
        await or_auto.initialize()

        # Parse parameters
        parameters = {}
        if args.temperature is not None:
            parameters["temperature"] = args.temperature
        if args.max_tokens is not None:
            parameters["max_tokens"] = args.max_tokens
        if args.top_p is not None:
            parameters["top_p"] = args.top_p

        # Add model
        model_config = await or_auto.add_model(args.model, parameters)

        print_success(f"Model '{args.model}' added successfully!")
        print_info(f"Test status: {model_config.test_status}")
        print_info(f"Parameters: {json.dumps(model_config.parameters, indent=2)}")

        await or_auto.close()

    except Exception as e:
        print_error(f"Error: {e}")


async def cmd_test(args) -> None:
    """Test model command"""
    print_header(f"Test Model: {args.model}")

    config = load_config()
    api_key = args.api_key or config.get("api_key") or os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        print_error("API key not found. Run 'openrouter-auto setup' first.")
        return

    try:
        or_auto = create_openrouter_auto({
            "api_key": api_key,
            "storage_type": "memory",
        })
        await or_auto.initialize()

        result = await or_auto.test_model(args.model)

        if result.success:
            print_success(f"Model test passed!")
            print_info(f"Response time: {result.response_time:.2f}s")
            if result.tokens_used:
                print_info(f"Tokens used: {result.tokens_used}")
        else:
            print_error(f"Model test failed: {result.error}")

        await or_auto.close()

    except Exception as e:
        print_error(f"Error: {e}")


async def cmd_chat(args) -> None:
    """Chat command"""
    print_header(f"Chat with {args.model}")

    config = load_config()
    api_key = args.api_key or config.get("api_key") or os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        print_error("API key not found. Run 'openrouter-auto setup' first.")
        return

    try:
        or_auto = create_openrouter_auto({
            "api_key": api_key,
            "storage_type": "memory",
        })
        await or_auto.initialize()

        print(f"You: {args.message}\n")
        print("Assistant: ", end="", flush=True)

        req = ChatRequest(
            model=args.model,
            messages=[ChatMessage(role="user", content=args.message)],
        )

        if args.stream:
            # Stream response
            async for chunk in or_auto.stream_chat(req):
                content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if content:
                    print(content, end="", flush=True)
            print()
        else:
            # Regular response
            response = await or_auto.chat(req)
            print(response.choices[0]["message"]["content"])

        await or_auto.close()

    except Exception as e:
        print_error(f"Error: {e}")


async def cmd_config(args) -> None:
    """Show config command"""
    print_header("Configuration")

    config = load_config()
    config_path = get_config_path()

    print(f"Config file: {config_path}")
    print(f"Exists: {config_path.exists()}")

    if config:
        print("\nConfiguration:")
        # Don't print API key
        safe_config = {k: v for k, v in config.items() if k != "api_key"}
        safe_config["api_key"] = "***" if config.get("api_key") else "Not set"
        print(json.dumps(safe_config, indent=2))
    else:
        print("\nNo configuration found.")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        prog="openrouter-auto",
        description="OpenRouter Auto - Zero-configuration OpenRouter SDK",
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Setup command
    setup_parser = subparsers.add_parser("setup", help="Setup OpenRouter Auto")
    setup_parser.add_argument("--api-key", help="OpenRouter API key")

    # Models command
    models_parser = subparsers.add_parser("models", help="List available models")
    models_parser.add_argument("--free", action="store_true", help="Show only free models")
    models_parser.add_argument("--provider", help="Filter by provider")
    models_parser.add_argument("--search", help="Search models")
    models_parser.add_argument("--limit", type=int, default=20, help="Limit results")
    models_parser.add_argument("--api-key", help="OpenRouter API key")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a model")
    add_parser.add_argument("model", help="Model ID (e.g., anthropic/claude-3.5-sonnet)")
    add_parser.add_argument("--temperature", type=float, help="Temperature")
    add_parser.add_argument("--max-tokens", type=int, help="Max tokens")
    add_parser.add_argument("--top-p", type=float, help="Top P")
    add_parser.add_argument("--api-key", help="OpenRouter API key")

    # Test command
    test_parser = subparsers.add_parser("test", help="Test a model")
    test_parser.add_argument("model", help="Model ID")
    test_parser.add_argument("--api-key", help="OpenRouter API key")

    # Chat command
    chat_parser = subparsers.add_parser("chat", help="Chat with a model")
    chat_parser.add_argument("model", help="Model ID")
    chat_parser.add_argument("message", help="Message to send")
    chat_parser.add_argument("--stream", action="store_true", help="Stream response")
    chat_parser.add_argument("--api-key", help="OpenRouter API key")

    # Config command
    config_parser = subparsers.add_parser("config", help="Show configuration")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Run command
    commands = {
        "setup": cmd_setup,
        "models": cmd_models,
        "add": cmd_add,
        "test": cmd_test,
        "chat": cmd_chat,
        "config": cmd_config,
    }

    command = commands.get(args.command)
    if command:
        asyncio.run(command(args))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

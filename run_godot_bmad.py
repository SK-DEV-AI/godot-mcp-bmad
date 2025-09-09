import argparse
import asyncio
import json
import os
from dotenv import load_dotenv
from bmad_method.llm_connectors.openai_client import OpenAIClient
from bmad_method.llm_connectors.groq_client import GroqClient
from bmad_method.llm_connectors.openrouter_client import OpenRouterClient
from bmad_method.llm_connectors.ollama_client import OllamaClient
from godot_mcp_orchestrator import GodotMcpOrchestrator

async def main():
    # Load environment variables from .env file
    load_dotenv()

    parser = argparse.ArgumentParser(description="A CLI to send a high-level prompt to the BMAD-MCP integration.")
    parser.add_argument("prompt", type=str, help="The high-level prompt describing the desired changes.")
    parser.add_argument(
        "--llm", type=str, default="ollama",
        choices=['openai', 'groq', 'openrouter', 'ollama'],
        help="The LLM provider to use."
    )
    args = parser.parse_args()

    # The system prompt is now read from a dedicated file
    with open('bmad_method/prompts/godot_developer.md', 'r') as f:
        system_prompt = f.read()

    # A simple factory to get the correct client
    client_map = {
        'openai': OpenAIClient,
        'groq': GroqClient,
        'openrouter': OpenRouterClient,
        'ollama': OllamaClient,
    }

    client_class = client_map.get(args.llm)
    if not client_class:
        raise ValueError(f"Invalid LLM provider specified: {args.llm}")

    try:
        client = client_class()
    except ValueError as e:
        print(f"Error initializing client for '{args.llm}': {e}")
        print("Please ensure your API keys and settings are correct in the .env file.")
        return

    print(f"Generating plan with {args.llm.capitalize()}...")
    try:
        raw_plan_str = client.generate_plan(system_prompt, args.prompt)
    except Exception as e:
        print(f"\n--- ERROR: Failed to generate plan from LLM ---")
        print(f"An error occurred: {e}")
        print("------------------------------------------------")
        return

    try:
        json_command_list = json.loads(raw_plan_str)
        print("\nReceived valid JSON plan from LLM:")
        print(json.dumps(json_command_list, indent=2))
    except json.JSONDecodeError:
        print("\n--- ERROR: LLM did not return valid JSON ---")
        print("Raw output from LLM:")
        print(raw_plan_str)
        print("---------------------------------------------")
        return

    orchestrator = GodotMcpOrchestrator()
    await orchestrator.execute_plan(json_command_list, "ws://localhost:9080")

if __name__ == "__main__":
    asyncio.run(main())

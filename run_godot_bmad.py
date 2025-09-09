import argparse
import asyncio
import json
from dotenv import load_dotenv

from bmad_method.llm_connectors.openai_client import OpenAIClient
from bmad_method.llm_connectors.groq_client import GroqClient
from bmad_method.llm_connectors.openrouter_client import OpenRouterClient
from bmad_method.llm_connectors.ollama_client import OllamaClient
from bmad_method.bmad_service import BMADService
from godot_mcp_orchestrator import GodotMcpOrchestrator

MAX_RETRIES = 3

async def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="A CLI to orchestrate the BMAD-MCP integration with a closed feedback loop.")
    parser.add_argument("prompt", type=str, help="The high-level prompt describing the desired changes.")
    parser.add_argument(
        "--llm", type=str, default="ollama",
        choices=['openai', 'groq', 'openrouter', 'ollama'],
        help="The LLM provider to use."
    )
    args = parser.parse_args()

    # --- Client and Service Initialization ---
    client_map = {
        'openai': OpenAIClient, 'groq': GroqClient,
        'openrouter': OpenRouterClient, 'ollama': OllamaClient,
    }
    client_class = client_map.get(args.llm)
    if not client_class:
        raise ValueError(f"Invalid LLM provider specified: {args.llm}")

    try:
        llm_client = client_class()
    except ValueError as e:
        print(f"Error initializing client for '{args.llm}': {e}")
        return

    bmad_service = BMADService(llm_client)
    orchestrator = GodotMcpOrchestrator()

    # --- Initial Plan Generation ---
    try:
        print(f"INFO: Generating initial plan with {args.llm.capitalize()}...")
        raw_plan_str = bmad_service.generate_initial_plan(args.prompt)
        current_plan = json.loads(raw_plan_str)
    except Exception as e:
        print(f"\n--- FATAL: Failed to generate initial plan from LLM ---")
        print(f"An error occurred: {e}")
        return

    # --- Closed-Loop Execution ---
    for i in range(MAX_RETRIES):
        print(f"\n--- ATTEMPT {i+1}/{MAX_RETRIES} ---")
        print("Current plan to execute:")
        print(json.dumps(current_plan, indent=2))

        execution_result = await orchestrator.execute_plan(current_plan, "ws://localhost:9080")

        if execution_result['success']:
            print("\n--- ✅ PLAN EXECUTED SUCCESSFULLY ---")
            return

        print("\n--- ⚠️ PLAN EXECUTION FAILED ---")
        if i < MAX_RETRIES - 1:
            print("Requesting a corrected plan from the LLM...")
            try:
                raw_corrected_plan = bmad_service.generate_corrected_plan(
                    original_plan=current_plan,
                    failed_command=execution_result['failed_command'],
                    error_message=execution_result['error_message']
                )
                current_plan = json.loads(raw_corrected_plan)
            except Exception as e:
                print(f"\n--- FATAL: Failed to generate corrected plan from LLM ---")
                print(f"An error occurred: {e}")
                return
        else:
            print("\n--- ❌ MAXIMUM RETRIES REACHED ---")
            print("The LLM was unable to provide a working plan.")
            return

if __name__ == "__main__":
    asyncio.run(main())

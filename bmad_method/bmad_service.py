import json
from bmad_method.llm_connectors.base_client import BaseLlmClient

class BMADService:
    def __init__(self, llm_client: BaseLlmClient):
        self.llm_client = llm_client
        try:
            with open('bmad_method/prompts/godot_developer.md', 'r') as f:
                self.system_prompt = f.read()
        except FileNotFoundError:
            print("ERROR: System prompt file not found at 'bmad_method/prompts/godot_developer.md'")
            self.system_prompt = "You are a helpful assistant." # Fallback

    def generate_initial_plan(self, user_prompt: str) -> str:
        """
        Generates the initial execution plan by calling the LLM.
        """
        print("INFO: Generating initial plan from user prompt...")
        return self.llm_client.generate_plan(self.system_prompt, user_prompt)

    def generate_corrected_plan(self, original_plan: list, failed_command: dict, error_message: str) -> str:
        """
        Generates a corrected execution plan by asking the LLM to fix a failed command.
        """
        print("INFO: Generating corrected plan based on execution failure...")

        correction_prompt = f"""
The previous execution plan failed. Your task is to analyze the error and provide a new, corrected JSON plan that fixes the issue.

Original Plan that Failed:
{json.dumps(original_plan, indent=2)}

This was the command that failed:
{json.dumps(failed_command, indent=2)}

And here is the error message from the server:
{error_message}

Please provide a full, new JSON array of commands that corrects this error and achieves the original goal. Do not include any explanations or markdown, only the raw JSON array.
"""
        return self.llm_client.generate_plan(self.system_prompt, correction_prompt)

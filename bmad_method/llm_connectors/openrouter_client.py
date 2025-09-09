import os
from openai import OpenAI # OpenRouter uses an OpenAI-compatible API
from .base_client import BaseLlmClient

class OpenRouterClient(BaseLlmClient):
    def __init__(self):
        super().__init__()
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        self.base_url = os.getenv('OPENROUTER_BASE_URL')
        self.model = os.getenv('OPENROUTER_MODEL')
        if not self.api_key or 'YOUR_OPENROUTER_API_KEY_HERE' in self.api_key:
            raise ValueError("OpenRouter API key is missing or not set in .env file")
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    def generate_plan(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

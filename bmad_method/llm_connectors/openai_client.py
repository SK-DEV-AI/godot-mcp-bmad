import os
from openai import OpenAI
from .base_client import BaseLlmClient

class OpenAIClient(BaseLlmClient):
    def __init__(self):
        super().__init__()
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('OPENAI_MODEL')
        if not self.api_key or 'YOUR_OPENAI_API_KEY_HERE' in self.api_key:
            raise ValueError("OpenAI API key is missing or not set in .env file")
        self.client = OpenAI(api_key=self.api_key)

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

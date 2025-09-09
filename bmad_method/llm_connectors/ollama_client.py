import os
import requests
import json
from .base_client import BaseLlmClient

class OllamaClient(BaseLlmClient):
    def __init__(self):
        super().__init__()
        self.base_url = os.getenv('OLLAMA_BASE_URL')
        self.model = os.getenv('OLLAMA_MODEL')
        self.url = f"{self.base_url}/api/generate"

    def generate_plan(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": user_prompt,
            "format": "json",
            "stream": False
        }
        response = requests.post(self.url, json=payload)
        response.raise_for_status() # Raise an exception for bad status codes
        return response.json()['response']

# bmad-method/llm_connectors/base_client.py
from abc import ABC, abstractmethod

class BaseLlmClient(ABC):
    def __init__(self):
        """Base class for LLM clients."""
        pass

    @abstractmethod
    def generate_plan(self, system_prompt: str, user_prompt: str) -> str:
        """
        Takes a system and user prompt, sends it to the configured LLM,
        and returns the raw JSON string response.
        """
        pass

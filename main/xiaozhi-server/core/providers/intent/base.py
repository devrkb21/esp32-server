from abc import ABC, abstractmethod
from typing import List, Dict
from config.logger import setup_logging

TAG = __name__
logger = setup_logging()


class IntentProviderBase(ABC):
    def __init__(self, config):
        self.config = config

    def set_llm(self, llm):
        self.llm = llm
        # Get model name and type information
        model_name = getattr(llm, "model_name", str(llm.__class__.__name__))
        # Log model name and details
        logger.bind(tag=TAG).info(f"Intent recognition set LLM: {model_name}")

    @abstractmethod
    async def detect_intent(self, conn, dialogue_history: List[Dict], text: str) -> str:
        """
        Detect user intent from the last utterance
        Args:
            dialogue_history: Dialogue history list, each record containing role and content
            text: Current dialogue record
        Returns:
            Identified intent function call JSON string
        """
        pass

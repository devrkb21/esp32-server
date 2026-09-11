import requests
from requests.exceptions import RequestException
from config.logger import setup_logging
from core.providers.llm.base import LLMProviderBase

TAG = __name__
logger = setup_logging()


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.agent_id = config.get("agent_id")  # Corresponds to agent_id
        self.api_key = config.get("api_key")
        self.base_url = config.get("base_url", config.get("url"))  # Defaults to base_url
        self.api_url = f"{self.base_url}/api/conversation/process"  # Full API URL

    def response(self, session_id, dialogue, **kwargs):
        # Home Assistant voice assistant handles its own intents; pass user utterances directly

        # Extract content of the last user message
        input_text = None
        if isinstance(dialogue, list):  # Ensure dialogue is a list
            # Traverse in reverse to find last user message
            for message in reversed(dialogue):
                if message.get("role") == "user":  # Found user message
                    input_text = message.get("content", "")
                    break  # Exit loop immediately upon match

        # Construct request payload
        payload = {
            "text": input_text,
            "agent_id": self.agent_id,
            "conversation_id": session_id,  # Use session_id as conversation_id
        }
        # Set headers
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Send POST request
        with requests.post(self.api_url, json=payload, headers=headers) as response:
            # Check if request succeeded
            response.raise_for_status()

            # Parse response data
            data = response.json()
        speech = (
            data.get("response", {})
            .get("speech", {})
            .get("plain", {})
            .get("speech", "")
        )

        # Yield speech content
        if speech:
            yield speech
        else:
            logger.bind(tag=TAG).warning("API response does not contain speech content")

    def response_with_functions(self, session_id, dialogue, functions=None):
        logger.bind(tag=TAG).error(
            "Home Assistant does not support function calls; consider using another intent provider"
        )
